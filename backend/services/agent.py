import json
import os
import time

import redis.asyncio as redis
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

# Rule-gate phrase lists
STUCK_PHRASES = [
    "i'm stuck", "im stuck", "i don't know", "i dont know",
    "not sure how", "don't know how", "no idea how",
    "i don't understand", "i dont understand", "i'm confused",
    "i'm lost", "i don't get it", "not sure what", "not sure where",
]
HINT_PHRASES = [
    "can i get a hint", "give me a hint", "is this the right direction",
    "what should i look at", "am i on the right track",
]
QUESTION_SIGNALS = [
    "should i", "what if", "does this need", "do i need",
    "how do i", "what do i", "how should i", "how would i",
    "how can i", "what's the best", "what is the best",
    "why is", "why does", "why would", "what happens", "?",
]
DECISION_PHRASES = [
    "i'll go with", "i'll use", "i'm going to use", "i'm choosing", "i'll choose",
]

RUBRIC_ENFORCEMENT = """Rubric enforcement:
- Treat each rubric table row as an independent requirement scored from 1 to 4.
- A score of 3 or 4 requires codebase-specific evidence: files, functions, data fields, state transitions, failure modes, tests, or tradeoffs.
- Do not accept broad definitions, memorized concepts, or confident generic answers as sufficient.
- If the candidate gives a generic answer, ask one targeted follow-up that forces them to anchor the answer in the visible codebase.
- Move on only after collecting code-specific evidence or clearly noting that the evidence is missing."""


def rule_gate(text: str) -> str | None:
    lower = text.lower()
    for phrase in STUCK_PHRASES:
        if phrase in lower:
            return "stuck"
    for phrase in HINT_PHRASES:
        if phrase in lower:
            return "hint_request"
    for phrase in DECISION_PHRASES:
        if phrase in lower:
            return "decision"
    for phrase in QUESTION_SIGNALS:
        if phrase in lower:
            return "question"
    return None


async def get_rolling_window(session_id: str, r: redis.Redis, window_seconds: int = 40) -> str:
    raw_chunks = await r.lrange(f"session:{session_id}:transcript_chunks", -50, -1)
    cutoff_ms = int(time.time() * 1000) - (window_seconds * 1000)
    texts = [
        json.loads(c)["text"]
        for c in raw_chunks
        if json.loads(c)["timestamp_ms"] >= cutoff_ms
    ]
    return " ".join(texts)


async def get_memory(session_id: str, r: redis.Redis) -> str:
    items = await r.lrange(f"session:{session_id}:memory_notes", 0, -1)
    return "; ".join(items) if items else "Nothing covered yet."


async def get_stage(session_id: str, r: redis.Redis) -> int:
    val = await r.get(f"session:{session_id}:current_stage")
    return int(val) if val else 0


async def advance_stage(session_id: str, r: redis.Redis):
    await r.incr(f"session:{session_id}:current_stage")


async def maybe_respond(session_id: str, r: redis.Redis) -> str | None:
    window = await get_rolling_window(session_id, r)
    if not window:
        return None

    trigger = rule_gate(window)
    print(f"[rule-gate] window: {window!r} → trigger: {trigger}")
    if not trigger:
        return None

    meta_raw = await r.get(f"session:{session_id}:meta")
    if not meta_raw:
        return None
    meta = json.loads(meta_raw)

    code_raw = await r.get(f"session:{session_id}:latest_code")
    code_snapshot = code_raw or "(no code written yet)"
    memory = await get_memory(session_id, r)
    stage = await get_stage(session_id, r)

    guidelines = meta.get("question_guidelines", "")

    if trigger in ("stuck", "hint_request"):
        response = await _guide_response(meta, code_snapshot, window, memory, stage, guidelines)
    else:
        # question or decision — decide whether to nudge or advance the interview
        response = await _interviewer_response(meta, code_snapshot, window, memory, stage, guidelines)

    print(f"[openai] raw response: {response!r}")

    if not response or response.strip().upper() == "NONE":
        return None

    event = {
        "type": "agent_response",
        "t_start": time.time(),
        "t_end": time.time(),
        "quote": window[-200:],
        "label": response,
        "trigger": trigger,
        "stage": stage,
    }
    await r.rpush(f"session:{session_id}:events", json.dumps(event))
    await r.rpush(f"session:{session_id}:memory_notes", response[:120])

    return response


async def _guide_response(meta: dict, code: str, window: str, memory: str, stage: int, guidelines: str) -> str:
    prompt = f"""You are a senior software engineer conducting a technical interview for the role: {meta["problem_title"]}.

Here is the interview rubric you are following:
{guidelines if guidelines else "(no rubric provided)"}

{RUBRIC_ENFORCEMENT}

The candidate's current code:
{code}

What the candidate just said:
"{window}"

What has been discussed so far in this session: {memory}
Current interview stage: {stage}

The candidate is stuck or confused. Give them ONE brief nudge - 1-2 sentences max. Speak like a colleague sitting next to them. Don't lecture. Don't give the answer away. Use plain, direct language. No "Great question!" or filler phrases.

If you genuinely cannot help without giving away the answer, respond with exactly: NONE"""

    return await _call_openai(prompt, model="gpt-4o-mini")


async def _interviewer_response(meta: dict, code: str, window: str, memory: str, stage: int, guidelines: str) -> str:
    prompt = f"""You are a senior software engineer conducting a technical interview for the role: {meta["problem_title"]}.

Here is the interview rubric you are following:
{guidelines if guidelines else "(no rubric provided)"}

{RUBRIC_ENFORCEMENT}

The candidate's current code:
{code}

What the candidate just said:
"{window}"

What has been discussed so far: {memory}
Current interview stage: {stage}

The candidate asked a question or made a statement about their approach. Do ONE of the following:
1. If their answer is generic, ask a targeted follow-up that forces a concrete file, function, data field, state transition, failure mode, test, or tradeoff from this codebase.
2. If their question shows they are ready to move to the next area of the rubric, ask the next natural interview question from the rubric - conversationally, like a curious engineer, not a scripted interviewer.
3. If they need a nudge on the current area, give a brief practical hint (1-2 sentences).

Speak naturally. No filler phrases. No "That's a great point." If the candidate's statement requires no response (just thinking out loud), respond with exactly: NONE"""

    return await _call_openai(prompt, model="gpt-4o-mini")


async def _call_openai(prompt: str, model: str) -> str:
    print(f"[openai] calling {model}")
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()
