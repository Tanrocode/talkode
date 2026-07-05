import asyncio
import json
import time

from fastapi import APIRouter, BackgroundTasks, HTTPException
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
from services.test_generator import (
    SUPPORTED_LANGUAGES,
    get_or_generate_harness,
)
from services.test_runner import run_tests
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

2. COMPLETENESS: this dataset is scraped from web pages. Common defects:
   a) A sentence ending in a colon that promises something ("the following interface:", "for example:") and then
      the text just moves on without delivering it.
   b) The description field contains ONLY example data ("Example 1: Input: ... Output: ...") with no actual
      problem statement explaining what the candidate is supposed to implement. If a candidate read only the
      description they would not know what to do — this is broken.
   c) The description is missing critical information (input format, output format, what to return) such that
      the problem cannot be solved from the description alone.

   Decide:
   - "fixable": the gap is small and mechanical (e.g. you can tell exactly what list/example should follow from
     the starter code or examples) — in this case, write a corrected description that fills ONLY that gap. Do
     not rewrite, rephrase, or improve anything else about the description.
   - "broken": the gap is more than a small mechanical fix, the description is essentially just examples with no
     problem statement, or the question is confusing/ambiguous/missing information needed to solve it.

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
        return {"relevant": True, "status": "complete", "fixed_description": "", "reason": "evaluation skipped (error)"}


async def _grade_submission(
    problem: dict,
    code: str,
    language: str,
    run_results: list[dict] | None = None,
) -> dict:
    """Grade the candidate's submission.

    If run_results are available (from the /run endpoint), the score is a
    weighted combination of test pass rate (weight 3.0) and LLM code quality
    (weight 1.0), capped at 4.0.

    If no run results exist, falls back to pure LLM scoring (0-4).
    """
    has_tests = bool(run_results)

    if has_tests:
        total = len(run_results)
        passed = sum(1 for r in run_results if r.get("passed"))
        test_pass_rate = passed / total if total > 0 else 0.0

        quality_prompt = f"""You are reviewing a candidate's coding solution for code quality only.
Tests have already been run externally: {passed}/{total} passed.

Problem: {problem.get("title")} ({problem.get("difficulty")})
Description:
{problem.get("description", "")}

Candidate's code ({language}):
{code or "(no code submitted)"}

Rate the CODE QUALITY on a 0.0-1.0 scale (not correctness, which is handled by tests):
- 1.0: clean, well-structured, optimal time/space complexity, clear variable names
- 0.75: good approach, minor style issues or slightly suboptimal
- 0.5: workable but messy, poor variable names, or unnecessary complexity
- 0.25: hard to read, poor structure, or notably wrong complexity even if tests pass
- 0.0: blank, trivially wrong approach, or clearly copied boilerplate with no real solution

Return JSON with exactly:
{{
  "quality": <float 0.0-1.0>,
  "correct": <bool — true if test pass rate >= 0.6>,
  "time_complexity": "e.g. O(n)",
  "feedback": "2-3 sentences citing specifics from the code"
}}"""

        try:
            resp = await llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": quality_prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            quality_data = json.loads(resp.choices[0].message.content)
            llm_quality = float(quality_data.get("quality", 0.5))
        except Exception as e:
            print(f"[challenge] quality grading failed: {e}")
            llm_quality = 0.5
            quality_data = {
                "correct": test_pass_rate >= 0.6,
                "time_complexity": "unknown",
                "feedback": "Quality grading failed.",
            }

        final_score = min(4.0, round(test_pass_rate * 3.0 + llm_quality * 1.0, 1))
        return {
            "score": final_score,
            "correct": quality_data.get("correct", test_pass_rate >= 0.6),
            "time_complexity": quality_data.get("time_complexity", "unknown"),
            "feedback": quality_data.get("feedback", ""),
            "test_pass_rate": test_pass_rate,
            "tests_passed": passed,
            "tests_total": total,
        }

    # Fallback: pure LLM scoring (no test results)
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


async def _prime_harnesses(frontend_id: str, problem: dict, r) -> None:
    """Pre-generate harnesses for all supported languages in parallel.

    Called as a BackgroundTask when a challenge is served. Results are cached
    in Redis so the first /run call per language is instant.
    """
    tasks = [
        get_or_generate_harness(frontend_id, problem, lang, r)
        for lang in SUPPORTED_LANGUAGES
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    ok = sum(1 for r in results if r and not isinstance(r, Exception))
    print(f"[challenge] primed {ok}/{len(SUPPORTED_LANGUAGES)} harnesses for {frontend_id}")


@router.post("/{session_id}/challenge")
async def start_challenge(session_id: str, background_tasks: BackgroundTasks):
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
        print(f"[challenge] no candidate passed evaluation for session {session_id}, falling back")
        problem = pool[0]

    await r.set(f"session:{session_id}:challenge", json.dumps(problem))

    # Pre-generate test harnesses in the background while the candidate reads the problem
    frontend_id = problem.get("frontend_id", problem.get("title", session_id))
    background_tasks.add_task(_prime_harnesses, frontend_id, problem, r)

    intro_text = (
        f"Let's pause for a quick coding detour. {problem['intro']} "
        f"Here's the problem: {problem['title']}. Take a few minutes, then submit when you're ready."
    )
    await log_agent_turn(session_id, r, intro_text)
    audio_b64 = await synthesize(intro_text)

    candidate_problem = {k: v for k, v in problem.items() if k != "solution"}

    return {"problem": candidate_problem, "intro_text": intro_text, "intro_audio_b64": audio_b64}


class ChallengeRunBody(BaseModel):
    code: str
    language: str = "python3"


@router.post("/{session_id}/challenge/run")
async def run_challenge(session_id: str, body: ChallengeRunBody):
    r = get_redis()
    challenge_raw = await r.get(f"session:{session_id}:challenge")
    if not challenge_raw:
        raise HTTPException(status_code=404, detail="No challenge active for this session")

    problem = json.loads(challenge_raw)
    frontend_id = problem.get("frontend_id", problem.get("title", session_id))

    harness = await get_or_generate_harness(frontend_id, problem, body.language, r)
    if harness is None:
        return {"status": "not_ready", "results": []}

    results = await run_tests(body.code, body.language, harness)

    # Store full results (visible + hidden) for grading at submit time
    await r.set(
        f"session:{session_id}:challenge_run_results",
        json.dumps({"language": body.language, "results": results}),
    )

    # Return only visible test results to the candidate
    visible = [r for r in results if r.get("visible", True)]
    hidden = [r for r in results if not r.get("visible", True)]
    hidden_passed = sum(1 for r in hidden if r.get("passed"))

    return {
        "status": "ok",
        "results": visible,
        "hidden_total": len(hidden),
        "hidden_passed": hidden_passed,
    }


class ChallengeSubmitBody(BaseModel):
    code: str
    language: str = "python3"


@router.post("/{session_id}/challenge/submit")
async def submit_challenge(session_id: str, body: ChallengeSubmitBody):
    r = get_redis()
    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")
    meta = json.loads(raw)

    challenge_raw = await r.get(f"session:{session_id}:challenge")
    challenge = json.loads(challenge_raw) if challenge_raw else {}
    title = challenge.get("title", "the coding challenge")

    await r.set(f"session:{session_id}:challenge_code", body.code)
    await r.set(f"session:{session_id}:challenge_language", body.language)
    await log_candidate_turn(
        session_id, r, f"[Submitted coding challenge: {title}]", "challenge_submit"
    )

    # Use the most recent /run results if the language matches; otherwise grade without tests
    run_results: list[dict] | None = None
    run_raw = await r.get(f"session:{session_id}:challenge_run_results")
    if run_raw:
        run_data = json.loads(run_raw)
        if run_data.get("language") == body.language:
            run_results = run_data.get("results")

    grade = await _grade_submission(challenge, body.code, body.language, run_results)
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
