import json
import logging
import os
import random
import re
import time

import redis.asyncio as redis
from openai import AsyncOpenAI

try:
    from thetokencompany.openai import with_compression
except ImportError:  # SDK optional — fall back to a plain client
    with_compression = None

# Never use TTC here — the TTC wrapper uses a sync HTTP transport that blocks
# the asyncio event loop. During a live interview the event loop also runs the
# Deepgram WebSocket; a blocked loop causes Deepgram to miss heartbeats, drop
# its connection, and stop delivering transcript events after the first turn.
client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

# File logger — tail -f backend/agent_debug.log while testing
_log_path = os.path.join(os.path.dirname(__file__), "..", "agent_debug.log")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(_log_path, mode="a", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("agent")

UNCLEAR_RESPONSES = [
    "Sorry, I didn't quite catch that — could you say that again?",
    "I'm not sure I followed. What were you thinking about there?",
    "Can you walk me through that again? I lost the thread.",
]

SHARED_SYSTEM = """You are a senior software engineer conducting a technical interview.
You are sitting next to the candidate as they code — not hosting a show, not teaching a class.

Rules:
- 1-2 sentences. Never more than 3.
- Never use: "Great!", "Excellent!", "That's a good point", "Interesting!", or any filler affirmation.
- Never lecture. Never give the answer directly.
- Vary your phrasing every response — do not repeat the same sentence structure twice.
- If you have nothing useful to add, respond with exactly: NONE"""


# ---------------------------------------------------------------------------
# Conversation history
# ---------------------------------------------------------------------------

async def log_agent_turn(session_id: str, r: redis.Redis, text: str):
    entry = {"role": "agent", "text": text, "ts": int(time.time() * 1000)}
    await r.rpush(f"session:{session_id}:conversation_history", json.dumps(entry))


async def log_candidate_turn(session_id: str, r: redis.Redis, text: str, intent: str):
    entry = {"role": "candidate", "text": text, "intent": intent, "ts": int(time.time() * 1000)}
    await r.rpush(f"session:{session_id}:conversation_history", json.dumps(entry))


async def get_conversation_history(session_id: str, r: redis.Redis, n: int = 16) -> list[dict]:
    raw = await r.lrange(f"session:{session_id}:conversation_history", -n, -1)
    return [json.loads(item) for item in raw]


def _format_history(history: list[dict]) -> str:
    lines = []
    for turn in history:
        speaker = "Interviewer" if turn["role"] == "agent" else "Candidate"
        lines.append(f"{speaker}: {turn['text']}")
    return "\n".join(lines) if lines else "(no prior conversation)"


def _last_agent_turn(history: list[dict]) -> str | None:
    for turn in reversed(history):
        if turn["role"] == "agent":
            return turn["text"]
    return None


# ---------------------------------------------------------------------------
# Stage helpers
# ---------------------------------------------------------------------------

async def get_stage(session_id: str, r: redis.Redis) -> int:
    val = await r.get(f"session:{session_id}:current_stage")
    return int(val) if val else 0


async def advance_stage(session_id: str, r: redis.Redis):
    await r.incr(f"session:{session_id}:current_stage")
    await r.set(f"session:{session_id}:stage_attempts", 0)
    log.info(f"[stage] advanced to stage {await get_stage(session_id, r)}")


async def get_stage_attempts(session_id: str, r: redis.Redis) -> int:
    val = await r.get(f"session:{session_id}:stage_attempts")
    return int(val) if val else 0


async def increment_stage_attempts(session_id: str, r: redis.Redis) -> int:
    val = await r.incr(f"session:{session_id}:stage_attempts")
    return int(val)


def extract_first_rubric_question(guidelines: str) -> str | None:
    """Pulls the first "Ask: ..." line out of the rubric text (the format
    produced by the assessment-creation flow, e.g. "## Q1: API Layer\nAsk:
    Walk me through..."), so the interview can open with a concrete question
    instead of a generic "explain the whole codebase" prompt."""
    match = re.search(r"Ask:\s*(.+)", guidelines or "")
    return match.group(1).strip() if match else None


# ---------------------------------------------------------------------------
# Coding-challenge trigger — fires once a topic has just closed (i.e. right
# after advance_stage()) and the candidate has demonstrated real
# understanding, measured by how many answers the agent has actually
# affirmed (correct_answer events), not just raw stage count. Raw stage
# count is a weak signal since _validate_and_followup is biased to advance
# even on partial answers.
# ---------------------------------------------------------------------------

CHALLENGE_READY_THRESHOLD = 2


async def get_correct_answer_count(session_id: str, r: redis.Redis) -> int:
    raw = await r.lrange(f"session:{session_id}:events", 0, -1)
    return sum(1 for e in raw if json.loads(e).get("type") == "correct_answer")


async def should_trigger_challenge(session_id: str, r: redis.Redis) -> bool:
    if await r.get(f"session:{session_id}:challenge_triggered"):
        return False
    count = await get_correct_answer_count(session_id, r)
    return count >= CHALLENGE_READY_THRESHOLD


# ---------------------------------------------------------------------------
# Intent classifier
# ---------------------------------------------------------------------------

async def classify_intent(utterance: str, last_agent: str | None, history: list[dict]) -> str:
    history_snippet = _format_history(history[-3:]) if history else "(no prior conversation)"
    last_agent_line = f'Interviewer just said: "{last_agent}"' if last_agent else "No prior interviewer turn."

    system = """You classify what a coding interview candidate just said into exactly one of these intents:

question     — candidate asked the interviewer something directly
answer       — candidate is responding to the interviewer's last question
claim        — candidate made a technical assertion about their code or approach
stuck        — candidate expressed confusion, being lost, or asked for a hint
decision     — candidate announced a direction or choice ("I'll use X", "I'm going to try Y")
end_request  — candidate explicitly wants to END THE ENTIRE INTERVIEW SESSION — not finish a task, section, or question. They must name the interview/session itself as the thing to end.
filler       — utterance is pure filler with no semantic content ("um", "uh", "like", "yeah so")
unclear      — utterance is incoherent, too fragmented to classify, or semantically empty
off_topic    — clearly unrelated to the interview (personal remarks, ambient noise, non-technical chatter)

Instructions:
- First mentally strip filler words ("um", "like", "you know", "so yeah") and identify the semantic core.
- If the semantic core is empty after stripping, return: filler
- For end_request: ONLY classify as end_request if the candidate explicitly wants to stop the whole interview/session. Saying "I'm done with the coding question / this part / this section" is NOT end_request — that is an answer or decision. The word "done" alone is NOT enough.
- Use the interviewer's last turn to determine if the candidate is answering a question.
- Return ONLY the single intent word. No explanation, no punctuation.

Examples:
Candidate: "um yeah so" → filler
Candidate: "should I use BFS or DFS here?" → question
Candidate: "I think this is O(n log n)" → claim
Candidate: "wait I'm totally lost on this" → stuck
Candidate: "I'll go with a hash map" → decision
Candidate: "yeah so like the recursion handles the base case" [after interviewer asked about base case] → answer
Candidate: "my phone just buzzed sorry" → off_topic
Candidate: "uh I mean the thing with the... yeah" → unclear
Candidate: "I think I'm done with the coding question" → answer
Candidate: "I'm done with this part, let's move on" → decision
Candidate: "that's all I've got for this section" → answer
Candidate: "I'm done, just end the interview" → end_request
Candidate: "can we stop the interview? I've given it my best" → end_request
Candidate: "I want to end the session now" → end_request"""

    user = f"""{last_agent_line}

Recent conversation:
{history_snippet}

Candidate just said: "{utterance}"

Intent:"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=10,
        temperature=0.1,
    )
    result = response.choices[0].message.content.strip().lower()
    valid = {"question", "answer", "claim", "stuck", "decision", "end_request", "filler", "unclear", "off_topic"}
    return result if result in valid else "unclear"


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

_AFFIRMATIVES = {"yes", "yeah", "yep", "yup", "sure", "ok", "okay", "correct",
                 "please", "go ahead", "do it", "end it", "yes please", "yes end"}


async def maybe_respond(session_id: str, r: redis.Redis) -> tuple[str | None, bool]:
    """Returns (response_text, challenge_ready). challenge_ready is True at
    most once per session — the moment right after a topic closes via an
    affirmed answer, once the candidate has demonstrated enough understanding
    (see should_trigger_challenge)."""
    raw_chunks = await r.lrange(f"session:{session_id}:transcript_chunks", -1, -1)
    if not raw_chunks:
        return None, False
    utterance = json.loads(raw_chunks[0])["text"].strip()
    if not utterance:
        return None, False

    history = await get_conversation_history(session_id, r)
    last_agent = _last_agent_turn(history)

    # If we're waiting on confirmation to end the interview, check whether the
    # candidate just gave an affirmative before running the full classifier.
    if await r.get(f"session:{session_id}:end_confirmed"):
        normalized = utterance.lower().strip().rstrip(".!,")
        if normalized in _AFFIRMATIVES:
            response = "Got it — thanks for your time today. We'll wrap up here."
            await r.set(f"session:{session_id}:interview_complete", "1")
            await r.delete(f"session:{session_id}:end_confirmed")
            await log_candidate_turn(session_id, r, utterance, "end_request")
            await log_agent_turn(session_id, r, response)
            log.info("[interview] end confirmed via affirmative — marked complete")
            return response, False

    intent = await classify_intent(utterance, last_agent, history)
    log.info(f"[classifier] {utterance!r} → {intent}")

    await log_candidate_turn(session_id, r, utterance, intent)

    if intent == "filler":
        return None, False

    if intent == "unclear":
        return random.choice(UNCLEAR_RESPONSES), False

    meta_raw = await r.get(f"session:{session_id}:meta")
    if not meta_raw:
        return None, False
    meta = json.loads(meta_raw)

    code_raw = await r.get(f"session:{session_id}:latest_code")
    code = code_raw or "(no code written yet)"
    stage = await get_stage(session_id, r)
    guidelines = meta.get("question_guidelines", "")
    history_text = _format_history(history)
    challenge_ready = False

    if intent == "answer":
        attempts = await increment_stage_attempts(session_id, r)
        # If affirming this answer would cross the challenge threshold, tell
        # the model up front so it gives a clean closing line instead of its
        # usual "affirm + immediately ask the next rubric question" — that
        # combo would otherwise abandon a brand-new question the moment the
        # challenge interrupts.
        current_count = await get_correct_answer_count(session_id, r)
        already_triggered = bool(await r.get(f"session:{session_id}:challenge_triggered"))
        about_to_pause = (not already_triggered) and (current_count + 1 >= CHALLENGE_READY_THRESHOLD)
        result = await _validate_and_followup(
            meta, code, utterance, last_agent, history_text, stage, guidelines, attempts, about_to_pause
        )
        response = result["response"]
        if result.get("affirmed") and result.get("label"):
            await r.rpush(f"session:{session_id}:events", json.dumps({
                "type": "correct_answer",
                "t_start": time.time(),
                "t_end": time.time(),
                "quote": utterance,
                "label": result["label"],
                "stage": stage,
            }))
            log.info(f"[event] correct_answer logged: {result['label']!r}")
        if result.get("interview_complete"):
            await r.set(f"session:{session_id}:interview_complete", "1")
            log.info("[interview] marked complete")
        elif response and "NONE" not in response.upper():
            await advance_stage(session_id, r)
            if await should_trigger_challenge(session_id, r):
                await r.set(f"session:{session_id}:challenge_triggered", "1")
                challenge_ready = True
                log.info("[challenge] trigger condition met — challenge_ready=True")
    elif intent == "claim":
        attempts = await increment_stage_attempts(session_id, r)
        response = await _validate_claim(meta, code, utterance, history_text, stage, guidelines, attempts)
        if attempts >= 3 and response and "NONE" not in response.upper():
            await advance_stage(session_id, r)
    elif intent == "question":
        response = await _answer_candidate_question(meta, code, utterance, history_text, stage, guidelines)
    elif intent == "stuck":
        response = await _guide_response(meta, code, utterance, history_text, stage, guidelines)
    elif intent == "decision":
        response = await _affirm_decision(meta, code, utterance, history_text, stage, guidelines)
    elif intent == "end_request":
        # Only end immediately if the candidate already confirmed once.
        # On the first request, ask for confirmation so a stray "I'm done"
        # mid-task doesn't accidentally kill the session.
        already_confirmed = await r.get(f"session:{session_id}:end_confirmed")
        if already_confirmed:
            response = "Got it — thanks for your time today. We'll wrap up here."
            await r.set(f"session:{session_id}:interview_complete", "1")
            log.info("[interview] candidate confirmed end — marked complete")
        else:
            await r.set(f"session:{session_id}:end_confirmed", "1", ex=60)
            response = "Just to confirm — you want to end the whole interview, not just this section?"
            log.info("[interview] end_request — asking for confirmation")
    elif intent == "off_topic":
        response = await _redirect_offtopic(meta, last_agent)
    else:
        return None, False

    log.info(f"[agent] response: {response!r}")

    if not response or "NONE" in response.upper():
        return None, challenge_ready

    await log_agent_turn(session_id, r, response)

    event = {
        "type": "agent_response",
        "t_start": time.time(),
        "t_end": time.time(),
        "quote": utterance[-200:],
        "label": response,
        "trigger": intent,
        "stage": stage,
    }
    await r.rpush(f"session:{session_id}:events", json.dumps(event))

    return response, challenge_ready


# ---------------------------------------------------------------------------
# Response handlers
# ---------------------------------------------------------------------------

async def _validate_and_followup(
    meta: dict, code: str, utterance: str, last_agent: str | None,
    history: str, stage: int, guidelines: str, attempts: int = 1,
    about_to_pause: bool = False,
) -> dict:
    force_advance = attempts >= 3
    stages_done = (
        f"Rubric stages 0 through {stage - 1} have already been fully covered — do NOT revisit them. "
        f"You are currently on stage {stage}."
    ) if stage > 0 else f"You are on stage 0 — the first rubric topic."

    if about_to_pause:
        instruction = """The conversation is about to pause for a short coding detour right after this turn.
- If the answer is reasonable or correct: affirm it briefly in 1 sentence and STOP THERE — do NOT ask a new
  follow-up question, do NOT introduce the next rubric topic. The pause is coming next, not a new question.
- If the answer is clearly wrong: correct one specific thing in 1 sentence, still without asking a new question.
- This turn should read as a clean stopping point, not a transition into something else."""
    elif force_advance:
        instruction = (
            f"IMPORTANT: This area has been probed {attempts} times. Move on now — affirm what they got and "
            "ask the next rubric question regardless of how complete the answer was."
        )
    elif attempts == 2:
        instruction = (
            "The candidate's first answer touched on part of this area but likely missed something important. "
            "Give them ONE specific nudge — point at the gap or hint at what to look for, WITHOUT giving the answer directly. "
            "Do NOT ask a new rubric question yet; stay on the current topic to give them a chance to fill the gap."
        )
    else:
        instruction = """Bias toward accepting and moving on. Only push back if the answer is clearly wrong or reveals a dangerous misconception.
- Reasonable or partially correct → affirm and move to the next rubric question immediately.
- Clearly wrong → correct one specific thing in one sentence, then still move to the next rubric question.
- Do NOT ask a follow-up clarifying question in the same area. Either affirm and advance, or correct and advance."""

    if about_to_pause:
        style_illustrations = """- "Yeah, that holds up."
- "Close enough — that's the right idea."
- "Not quite on that part, but the rest of the approach is solid.\""""
        response_field_note = ", and NO question mark anywhere in it"
    elif attempts == 2:
        style_illustrations = """- "Take a closer look at how error states propagate up from that function."
- "Think about what happens if the API returns a non-200 — where does that get handled right now?"
- "You're on the right track — what would break if the sort were skipped?\""""
        response_field_note = ""
    else:
        style_illustrations = """- "Yeah that's right. How does the data get from fetchEmployees to the UI?"
- "Close enough — the approach works. Walk me through what useEmployees is doing."
- "Not quite on the error part, but let's keep moving — how does data flow to the components?\""""
        response_field_note = ""

    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Your last question: "{last_agent or '(none)'}"
Candidate just answered: "{utterance}"
Current rubric stage: {stage}
{stages_done}
Times this area has been probed: {attempts}

{instruction}

Style illustrations ONLY — vary your phrasing, do not copy these:
{style_illustrations}

Return a JSON object with exactly these fields:
{{
  "response": "what you say to the candidate — spoken aloud, 1-3 sentences, no filler affirmations{response_field_note}",
  "affirmed": true if the candidate's answer was correct or acceptable, false if you are pushing back,
  "label": "if affirmed=true: a short past-tense phrase for the insight log, e.g. 'correctly identified O(n log n) time complexity'. Empty string if affirmed=false.",
  "interview_complete": true if ALL areas of the rubric have now been covered and there is nothing meaningful left to ask, false otherwise. If complete, the response should be a natural closing statement — thank the candidate and let them know the session is done.
}}"""

    raw = await _call_openai_json(SHARED_SYSTEM, user)
    result = raw if isinstance(raw, dict) else {"response": str(raw), "affirmed": False, "label": ""}

    # Defense in depth: the model doesn't always obey "don't ask a question"
    # reliably, so deterministically strip any trailing question sentence
    # rather than relying on the prompt alone.
    if about_to_pause and isinstance(result.get("response"), str):
        result["response"] = _strip_trailing_questions(result["response"])

    return result


def _strip_trailing_questions(text: str) -> str:
    # Split on sentence boundaries AND on ", but/so/and/yet" clause joins —
    # the model sometimes bundles the affirmation and the forbidden question
    # into one compound sentence ("X, but can you clarify Y?") rather than
    # two separate ones, which a sentence-only split would miss entirely.
    parts = re.split(r"(?<=[.!?])\s+|,\s+(?=but\b|so\b|and\b|yet\b)", text.strip())
    kept = [p for p in parts if "?" not in p]
    cleaned = " ".join(p.rstrip(",").strip() for p in kept).strip()
    if cleaned and not cleaned.endswith((".", "!")):
        cleaned += "."
    return cleaned or "Got it."


async def _validate_claim(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str, attempts: int = 1
) -> str:
    force_advance = attempts >= 3

    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate just claimed: "{utterance}"
Current rubric stage: {stage}
Times this area has been probed: {attempts}

{"IMPORTANT: This area has been probed " + str(attempts) + " times. Wrap it up now — affirm what they got right, briefly note what was missed if anything, then move on to the next rubric area." if force_advance else """Confirm or correct their claim in 1-2 sentences.
- If correct or a reasonable approach: affirm it clearly ("That's right" / "Solid") and optionally probe depth once more.
- If incorrect: point at the specific thing to reconsider without saying "wrong"."""}

Style illustrations ONLY — vary your phrasing, do not copy these:
- "Yeah, that holds. What about the worst case?"
- "Take another look at the loop bounds — what's the actual iteration count?"
- "Close enough — the approach works even if it's not optimal. Let's move on." """

    return await _call_openai(SHARED_SYSTEM, user)


async def _answer_candidate_question(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate asked: "{utterance}"
Current rubric stage: {stage}

Answer directly and practically in 1-2 sentences.
If answering would give away the solution, redirect instead with something like "What do you think?" or "Try it and see what happens."
Don't over-explain."""

    return await _call_openai(SHARED_SYSTEM, user)


async def _guide_response(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate is stuck: "{utterance}"
Current rubric stage: {stage}

Give them ONE brief nudge — 1-2 sentences. Point at something concrete in the code or problem without giving the answer away.

Style illustrations ONLY — vary your phrasing, do not copy these:
- "Look at what happens in the loop when the list is empty."
- "Think about what data structure would let you look that up in O(1)." """

    return await _call_openai(SHARED_SYSTEM, user)


async def _affirm_decision(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate announced a decision: "{utterance}"
Current rubric stage: {stage}

Acknowledge their decision briefly, then probe a tradeoff or edge case from the rubric. 1-2 sentences. Don't just say "sounds good" — push on something specific.

Style illustrations ONLY — vary your phrasing, do not copy these:
- "Go for it. What's the memory cost of that approach?"
- "That works. How does that hold up if the input has duplicates?" """

    return await _call_openai(SHARED_SYSTEM, user)


async def _redirect_offtopic(meta: dict, last_agent: str | None) -> str:
    last_line = f'You had just asked: "{last_agent}"' if last_agent else "There was no prior question."
    user = f"""The candidate said something unrelated to the interview.
{last_line}

Redirect them back to the problem in 1 sentence. If you had just asked a question, gently repeat or rephrase it."""

    return await _call_openai(SHARED_SYSTEM, user)


async def generate_resume_question(
    meta: dict, code: str, history_text: str, stage: int, guidelines: str
) -> str:
    """Generate a codebase question to ask immediately after the coding challenge ends."""
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far (the last few turns may be about the coding challenge):
{history_text}

Current rubric stage: {stage}

The coding challenge just ended and you briefly acknowledged it. Now pick back up where the codebase interview left off.
Ask ONE specific question about the codebase that addresses the next unvisited rubric area (or probes further into the current stage if it was not fully covered).
Do NOT reference the coding challenge. The question should read as a natural continuation, not a restart.
Return only the question text, nothing else."""

    return await _call_openai(SHARED_SYSTEM, user)


# ---------------------------------------------------------------------------
# OpenAI call
# ---------------------------------------------------------------------------

async def _call_openai(system: str, user: str) -> str:
    log.debug("[openai] calling gpt-4o-mini")
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=120,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()


async def _call_openai_json(system: str, user: str) -> dict:
    log.debug("[openai] calling gpt-4o-mini (json)")
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=200,
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    try:
        return json.loads(response.choices[0].message.content)
    except Exception:
        return {"response": response.choices[0].message.content.strip(), "affirmed": False, "label": ""}
