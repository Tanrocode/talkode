import json
import re
import time

import redis.asyncio as redis
from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

_RUBRIC_META_SECTIONS = {
    "interview flow", "expected signals", "project structure",
    "candidate task", "reported issues", "local api", "overview",
    "instructions", "notes", "context", "background", "scoring", "rubric",
}


def _extract_rubric_questions(rubric: str) -> list[str]:
    """Return the list of question/topic titles from rubric markdown.

    Tries three formats in order:
    1. Structured '## Q1: Title' headings (assessment-creation generated format).
    2. Generic '## Heading' lines that aren't known meta-sections.
    3. Bullet-point dimension list before the first '##' heading (e.g.
       'Score candidates across N dimensions:\\n- Code Navigation\\n- ...')."""
    q_style = re.findall(r"^##\s+(Q\d+[^#\n]+)", rubric, re.MULTILINE)
    if q_style:
        return [h.strip() for h in q_style]

    headings = re.findall(r"^##\s+(.+?)$", rubric, re.MULTILINE)
    non_meta = [
        h.strip() for h in headings
        if not any(meta in h.strip().lower() for meta in _RUBRIC_META_SECTIONS)
    ]
    if non_meta:
        return non_meta

    # Last resort: bullet list in the preamble before the first ## heading.
    first_heading = re.search(r"^##", rubric, re.MULTILINE)
    preamble = rubric[:first_heading.start()] if first_heading else rubric
    bullets = re.findall(r"^[-*]\s+(.+?)$", preamble, re.MULTILINE)
    return [b.strip() for b in bullets if b.strip()]


def _enforce_rubric_completeness(
    insights: dict, rubric: str, topics: list[str] | None = None
) -> None:
    """Backfill any rubric topics the LLM silently omitted with score=0.

    The LLM is instructed to include every rubric area (even ones never
    reached, scored 0), but it doesn't always comply.  This deterministic
    pass ensures the UI always shows the full rubric.

    Prefers the canonical, LLM-categorized `topics` list (computed once at
    rubric upload time) over the regex-based heading extraction, since it's
    stable across rubric formats — `_extract_rubric_questions` is only a
    fallback for rubrics created before that categorization existed."""
    questions = topics if topics else _extract_rubric_questions(rubric)
    if not questions:
        return

    existing = insights.get("rubric_scores", [])
    existing_text = " ".join(item["question"].lower() for item in existing)

    for q in questions:
        significant_words = [w for w in q.lower().split() if len(w) >= 4]
        already_present = any(word in existing_text for word in significant_words)
        if not already_present:
            existing.append({
                "question": q,
                "score": 0,
                "reason": "Not reached in session.",
            })

    insights["rubric_scores"] = existing


async def extract_insights(session_id: str, r: redis.Redis):
    """
    Runs after the pipeline completes. Reads all session data from Redis,
    makes one LLM call to generate structured insights + an intent map,
    and stores the result at session:{id}:insights.
    """
    meta_raw = await r.get(f"session:{session_id}:meta")
    if not meta_raw:
        return
    meta = json.loads(meta_raw)

    history_raw = await r.lrange(f"session:{session_id}:conversation_history", 0, -1)
    history = [json.loads(h) for h in history_raw]

    events_raw = await r.lrange(f"session:{session_id}:events", 0, -1)
    events = [json.loads(e) for e in events_raw]

    stage_val = await r.get(f"session:{session_id}:current_stage")
    final_stage = int(stage_val) if stage_val else 0

    code_raw = await r.get(f"session:{session_id}:latest_code")
    final_code = code_raw or "(no code written)"

    challenge_grade_raw = await r.get(f"session:{session_id}:challenge_grade")
    challenge_grade = json.loads(challenge_grade_raw) if challenge_grade_raw else None

    stuck_count = sum(1 for e in events if e.get("type") == "stuck")
    hint_count = sum(1 for e in events if e.get("type") == "hint_request")

    conversation_text = "\n".join(
        f"{'Interviewer' if t['role'] == 'agent' else 'Candidate'}: {t['text']}"
        for t in history
    )

    rubric = meta.get("question_guidelines", "").strip()
    has_rubric = bool(rubric)
    rubric_topics = [t for t in meta.get("rubric_topics", []) if isinstance(t, str) and t.strip()]
    rubric_section = rubric if has_rubric else "(no rubric was configured for this assessment)"
    problem = meta.get("problem_title", "Unknown problem")
    candidate = meta.get("candidate_name", "Candidate")

    challenge_section = ""
    if challenge_grade:
        challenge_section = f"""

Mid-interview coding challenge: {challenge_grade.get("title", "Coding challenge")}
- LLM-graded score (0-4): {challenge_grade.get("score")}
- Correct: {challenge_grade.get("correct")}
- Estimated time complexity: {challenge_grade.get("time_complexity")}
- Grading notes: {challenge_grade.get("feedback")}"""

    prompt = f"""You are analyzing a technical coding interview for HR. Produce a structured JSON assessment.

Ground every claim in this report — including the summary, strengths, and gaps, not just rubric_scores — in
something that actually appears in "Full conversation" below. If the candidate barely spoke or the conversation
is mostly the interviewer talking, say so plainly (e.g. "the candidate did not engage with the codebase discussion
before ending the session") rather than inferring a plausible-sounding performance from the task description or
codebase alone.

Candidate: {candidate}
Problem: {problem}

Rubric:
{rubric_section}
{(
        "\nCanonical scoring topics — report rubric_scores using exactly these titles, in this exact order, "
        "one entry per topic (still grade based on the full rubric content above, this list only fixes how "
        "the result is labeled):\n" + "\n".join(f"- {t}" for t in rubric_topics)
    ) if rubric_topics else ""}

Final code:
{final_code}

Full conversation:
{conversation_text or "(no conversation recorded)"}

Session stats:
- Times stuck: {stuck_count}
- Hints requested: {hint_count}
- Rubric stages reached: {final_stage}{challenge_section}

Return a JSON object with exactly these fields:
{{
  "summary": "4-6 sentence narrative for HR covering technical depth, communication clarity, and problem-solving approach as distinct angles",
  "strengths": ["short phrase", ...],
  "gaps": ["short phrase", ...],
  "advance_recommend": true or false,
  "advance_reason": "one sentence explaining the recommendation",
  "rubric_scores": [
    {{
      "question": "{(
        "must be one of the canonical scoring topics listed above, verbatim"
    ) if rubric_topics else "short question title matching the rubric heading, e.g. Q1: API Layer"}",
      "score": <integer 0-4, where:
        0 = not reached in session / no meaningful response at all,
        1 = significant confusion — named the wrong concept, missed the point entirely, or needed the answer essentially given to them,
        2 = partial — got the general area right but missed a key component even after being nudged by the interviewer; did not fully close the gap,
        3 = correctly identified the core concept and answered accurately — edge cases or optimizations may be missing but the substance is right,
        4 = exceptional depth: proactively identified trade-offs, edge cases, or optimizations unprompted>,
      "reason": "1-3 sentences citing specific evidence or direct quotes from the conversation that justify this score"
    }},
    ...
  ],
  "intent_map": [
    {{
      "ts_ms": <timestamp in ms from conversation history, use 0 if unknown>,
      "actor": "candidate" or "agent",
      "category": one of "explaining"|"stuck"|"decision"|"question"|"answer"|"coding"|"correction",
      "label": "short past-tense description of what happened, max 8 words",
      "quote": "exact words said"
    }},
    ...
  ]
}}

For advance_recommend: this must be mechanically consistent with the rubric_scores you produce, not a separate
holistic vibe. Do not let strong communication, confidence, or general competence outweigh specific gaps — a
candidate who explains themselves well but gets the substance wrong should not advance on the strength of their
communication alone.
- advance_recommend = false if ANY single rubric area scored 0-1 for ANY reason — including "not reached in
  session". A rubric area scored 0 means the candidate did not demonstrate that competency; the interview agent
  is designed to cover the entire rubric, so "not reached" is a gap, not an exemption. Also false if three or
  more areas scored 2 (one or two 2s with otherwise 3-4s reflects a strong candidate who missed a detail —
  that should not block advancement on its own).
- advance_recommend = true only if most rubric areas scored 3-4, with at most one area at 2, and NO area at 0-1.
- If a mid-interview coding challenge score is present, weigh it the same as any other rubric area under the
  rule above — a low challenge score counts as a gap like any other, it does not get special leniency for being
  "just a detour."
- advance_reason must name the specific rubric area(s) driving the decision (e.g. "scored low on error handling
  and performance despite strong API/data-flow understanding"), not a generic statement about communication.

For rubric_scores: {(
        "score every canonical topic listed above on the 0-4 scale (see the score descriptions in the rubric_scores "
        "field above). Return exactly one entry per canonical topic, using its title verbatim as \"question\" — "
        "never invent, split, merge, or rename topics. "
        "Calibration: score 3 when the candidate correctly identified the core concept even if they missed an "
        "optimization or edge case. Score 2 only when they missed a key component even after being nudged. "
        "Every score above 0 must be justified by something the CANDIDATE actually said in the conversation above — "
        "not by what a good candidate would likely have said, and not by inference from the codebase alone. "
        "If a topic was never reached or the candidate never addressed it, score it 0 with reason \"not reached in session\"."
    ) if rubric_topics else (
        "score every question in the rubric on the 0-4 scale (see the score descriptions in the rubric_scores "
        "field above). Use ONLY the questions explicitly listed in the Rubric section above — never invent additional "
        "questions from the README, the code, or the candidate task description. "
        "Calibration: score 3 when the candidate correctly identified the core concept even if they missed an "
        "optimization or edge case. Score 2 only when they missed a key component even after being nudged. "
        "Every score above 0 must be justified by something the CANDIDATE actually said in the conversation above — "
        "not by inference from the codebase or task description alone. "
        "If a rubric question was never reached or the candidate never addressed it, score it 0 with reason \"not reached in session\"."
    ) if has_rubric else (
        "this assessment has no rubric configured (see the Rubric section above), so you MUST return an empty array "
        "for rubric_scores. Do not invent rubric questions from the README, the code, or the candidate task "
        "description — there is no rubric to score against."
    )}
Do NOT include the mid-interview coding challenge in rubric_scores — it is scored separately and will be appended automatically.
For intent_map: include every meaningful candidate turn and key agent turns. Skip pure filler. Labels must be concise past-tense phrases like "explained the filter logic" or "got stuck on edge case". Do not copy these examples directly."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        insights = json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"[insights] LLM call failed: {e}")
        insights = {
            "summary": "Insight extraction failed.",
            "strengths": [],
            "gaps": [],
            "advance_recommend": False,
            "advance_reason": "Could not generate insights.",
            "rubric_scores": [],
            "intent_map": [],
        }

    if not has_rubric:
        # Hard guard, independent of whether the model followed instructions:
        # with no real rubric, any rubric_scores would necessarily be invented.
        insights["rubric_scores"] = []
    else:
        # Deterministic fallback: backfill any rubric topics the LLM silently
        # omitted (e.g. areas never reached during the session).
        _enforce_rubric_completeness(insights, rubric, rubric_topics)

    if challenge_grade:
        insights.setdefault("rubric_scores", []).append(
            {
                "question": f"Coding challenge: {challenge_grade.get('title', 'Untitled')}",
                "score": challenge_grade.get("score", 0),
                "reason": challenge_grade.get("feedback", "No grading notes available."),
            }
        )

    insights["stuck_count"] = stuck_count
    insights["hint_count"] = hint_count
    insights["final_stage"] = final_stage
    insights["generated_at"] = int(time.time() * 1000)

    await r.set(f"session:{session_id}:insights", json.dumps(insights))
    print(f"[insights] stored for session {session_id}")
