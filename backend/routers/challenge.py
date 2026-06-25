import json
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.agent import client as llm_client, log_agent_turn, log_candidate_turn
from services.challenge_picker import pick_challenge
from services.redis_client import get_redis
from services.tts import synthesize

router = APIRouter(prefix="/session", tags=["challenge"])


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

    problem = pick_challenge(session_id)
    if not problem:
        raise HTTPException(status_code=503, detail="No coding challenge available")

    await r.set(f"session:{session_id}:challenge", json.dumps(problem))

    intro_text = (
        f"Let's pause for a quick coding detour. {problem['intro']} "
        f"Here's the problem: {problem['title']}. Take a few minutes, then submit when you're ready."
    )
    await log_agent_turn(session_id, r, intro_text)
    audio_b64 = await synthesize(intro_text)

    return {"problem": problem, "intro_text": intro_text, "intro_audio_b64": audio_b64}


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

    ack_text = "Nice, got your submission — let's get back to the codebase."
    await log_agent_turn(session_id, r, ack_text)
    audio_b64 = await synthesize(ack_text)

    return {"ack_text": ack_text, "ack_audio_b64": audio_b64}
