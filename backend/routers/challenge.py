import json
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.agent import (
    client as llm_client,
    generate_resume_question,
    get_conversation_history,
    get_stage,
    _format_history,
    log_agent_turn,
    log_candidate_turn,
)
from services.challenge_picker import pick_challenge_pool
from services.redis_client import get_redis
from services.tts import synthesize

router = APIRouter(prefix="/session", tags=["challenge"])


async def _evaluate_candidate(problem: dict, codebase_context: str) -> dict:
    """Single LLM pass that decides whether a picked question is worth using:

    1. Relevance — does it touch on something that plausibly relates to the
       candidate's actual codebase (similar data structures, concepts, or
       performance concerns), not just a generic "efficiency" framing?
    2. Completeness — is the description/examples/constraints intact, or did
       the scrape lose something (a dangling "...following interface:" etc.)?

    If it's relevant but only has a small, mechanical gap (e.g. a missing
    interface list that the starter code already implies), the model is
    allowed to patch ONLY the description text and we use its fixed version —
    examples/constraints/starter code are never touched. If it's irrelevant,
    or broken beyond a small fix, it's rejected and the caller moves on to
    the next candidate in the pool.
    """
    examples_text = "\n".join(e.get("example_text", "") for e in problem.get("examples") or [])
    constraints_text = "\n".join(problem.get("constraints") or [])

    prompt = f"""You are screening a coding-interview question before it's shown to a candidate, mid-interview.

Candidate's actual codebase / assessment context:
{codebase_context or "(no codebase context available)"}

Candidate question being considered:
Title: {problem.get("title")}
Difficulty: {problem.get("difficulty")}
Topics: {", ".join(problem.get("topics") or [])}

Description:
{problem.get("description", "")}

Examples:
{examples_text or "(none)"}

Constraints:
{constraints_text or "(none)"}

Starter code:
{problem.get("starter_code", {}).get(problem.get("default_language", "python"), "")}

Evaluate two things:

1. RELEVANCE: does this question touch on a concept, data structure, or performance concern that plausibly
   relates to the codebase context above (e.g. the codebase does lookups and this is about hash maps; the
   codebase streams data and this is about sliding windows/queues; etc.)? It doesn't need to be a perfect match —
   just a genuine, explainable connection a candidate would find sensible, not a forced stretch.

2. COMPLETENESS: this dataset is scraped from web pages, so the most common defect is a sentence ending in a
   colon that promises something ("the following interface:", "for example, for the string t = \"aab\":") and
   then the text just moves on without ever giving what was promised. If you spot that pattern, or any other
   missing/contradictory content, decide:
   - "fixable": the gap is small and mechanical (e.g. you can tell exactly what list/example should follow from
     the starter code or examples) — in this case, write a corrected description that fills ONLY that gap. Do
     not rewrite, rephrase, or improve anything else about the description.
   - "broken": the gap is more than a small mechanical fix, or the question is confusing/ambiguous/missing
     information needed to solve it — do not attempt a fix.

Return a JSON object with exactly these fields:
{{
  "relevant": true or false,
  "status": "complete" or "fixable" or "broken",
  "fixed_description": "corrected description text if status is fixable, otherwise empty string",
  "reason": "one short sentence explaining the relevance and/or completeness verdict"
}}"""

    try:
        response = await llm_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(response.choices[0].message.content)
        result["status"] = result.get("status") if result.get("status") in ("complete", "fixable", "broken") else "broken"
        return result
    except Exception as e:
        print(f"[challenge] evaluation failed, treating as usable: {e}")
        # Don't let a flaky LLM call block the interview — fail open.
        return {"relevant": True, "status": "complete", "fixed_description": "", "reason": "evaluation skipped (error)"}


async def _grade_submission(problem: dict, code: str, language: str) -> dict:
    """LLM-graded review of the candidate's coding-challenge submission —
    there's no sandboxed test runner here, so this is a reasoning-based grade
    (0-4 scale matching the rubric scoring elsewhere) rather than executed
    test cases. Feeds into the final candidate report.
    """
    prompt = f"""You are grading a candidate's solution to a coding problem, submitted mid-interview.

Problem: {problem.get("title")}
Difficulty: {problem.get("difficulty")}
Description:
{problem.get("description", "")}

Constraints:
{chr(10).join(problem.get("constraints") or [])}

Candidate's submitted code (language: {language}):
{code or "(no code submitted)"}

Grade this on a 0-4 scale:
0 = blank or no real attempt
1 = far below — wrong approach or doesn't address the problem
2 = partial — reasonable attempt but incorrect or notably inefficient
3 = correct and reasonably efficient
4 = correct, efficient, and clean

Return a JSON object with exactly these fields:
{{
  "score": <integer 0-4>,
  "correct": true or false,
  "time_complexity": "best-effort estimate, e.g. O(n)",
  "feedback": "2-3 sentences a recruiter would read, citing specifics from the code"
}}"""

    try:
        response = await llm_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"[challenge] grading failed: {e}")
        return {
            "score": 0,
            "correct": False,
            "time_complexity": "unknown",
            "feedback": "Grading failed — submission could not be evaluated.",
        }


@router.post("/{session_id}/challenge")
async def start_challenge(session_id: str):
    r = get_redis()
    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")
    meta = json.loads(raw)
    codebase_context = meta.get("problem_statement", "")

    pool = pick_challenge_pool(session_id)
    if not pool:
        raise HTTPException(status_code=503, detail="No coding challenge available")

    problem = None
    for candidate in pool:
        verdict = await _evaluate_candidate(candidate, codebase_context)
        if not verdict.get("relevant") or verdict["status"] == "broken":
            print(f"[challenge] skipped {candidate['title']!r}: {verdict.get('reason')}")
            continue
        if verdict["status"] == "fixable" and verdict.get("fixed_description"):
            candidate = {**candidate, "description": verdict["fixed_description"]}
        problem = candidate
        break
    if problem is None:
        # Nothing passed — show the best-ranked one anyway rather than
        # blocking the interview entirely.
        print(f"[challenge] no candidate passed evaluation for session {session_id}, falling back")
        problem = pool[0]

    await r.set(f"session:{session_id}:challenge", json.dumps(problem))

    intro_text = (
        f"Let's pause for a quick coding detour. {problem['intro']} "
        f"Here's the problem: {problem['title']}. Take a few minutes, then submit when you're ready."
    )
    await log_agent_turn(session_id, r, intro_text)
    audio_b64 = await synthesize(intro_text)

    # Never send the reference solution to the candidate — it's only for the
    # recruiter report, surfaced via the dashboard challenge-review endpoint.
    candidate_problem = {k: v for k, v in problem.items() if k != "solution"}

    return {"problem": candidate_problem, "intro_text": intro_text, "intro_audio_b64": audio_b64}


class ChallengeSubmitBody(BaseModel):
    code: str
    language: str = "python3"


@router.post("/{session_id}/challenge/submit")
async def submit_challenge(session_id: str, body: ChallengeSubmitBody):
    r = get_redis()
    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")

    challenge_raw = await r.get(f"session:{session_id}:challenge")
    challenge = json.loads(challenge_raw) if challenge_raw else {}
    title = challenge.get("title", "the coding challenge")

    await r.set(f"session:{session_id}:challenge_code", body.code)
    await r.set(f"session:{session_id}:challenge_language", body.language)
    await log_candidate_turn(
        session_id, r, f"[Submitted coding challenge: {title}]", "challenge_submit"
    )

    grade = await _grade_submission(challenge, body.code, body.language)
    grade["title"] = title
    await r.set(f"session:{session_id}:challenge_grade", json.dumps(grade))

    await r.rpush(
        f"session:{session_id}:events",
        json.dumps(
            {
                "type": "coding_challenge_submitted",
                "t_start": time.time(),
                "t_end": time.time(),
                "quote": body.code[-200:],
                "label": title,
                "score": grade.get("score"),
            }
        ),
    )

    # Generate the next codebase question so the agent speaks immediately after
    # acknowledging the submission instead of waiting for the candidate to prompt.
    code_raw = await r.get(f"session:{session_id}:latest_code")
    code = code_raw or "(no code written yet)"
    stage = await get_stage(session_id, r)
    history = await get_conversation_history(session_id, r)
    history_text = _format_history(history)
    guidelines = meta.get("question_guidelines", "")
    try:
        resume_q = await generate_resume_question(meta, code, history_text, stage, guidelines)
    except Exception as e:
        print(f"[challenge] resume question failed: {e}")
        resume_q = "Let's pick up where we left off — walk me through a part of the codebase you haven't explained yet."

    combined_text = f"Nice, got your submission. {resume_q}"
    await log_agent_turn(session_id, r, combined_text)
    audio_b64 = await synthesize(combined_text)

    return {"ack_text": combined_text, "ack_audio_b64": audio_b64}
