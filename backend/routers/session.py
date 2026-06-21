import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.redis_client import get_redis

router = APIRouter(prefix="/session", tags=["session"])


class CreateSessionRequest(BaseModel):
    candidate_name: str
    problem_id: str
    problem_title: str
    problem_statement: str
    question_guidelines: str = ""  # saved assessment rubric


@router.post("")
async def create_session(body: CreateSessionRequest):
    session_id = str(uuid.uuid4())
    r = get_redis()

    meta = {
        "session_id": session_id,
        "candidate_name": body.candidate_name,
        "problem_id": body.problem_id,
        "problem_title": body.problem_title,
        "problem_statement": body.problem_statement,
        "question_guidelines": body.question_guidelines,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "status": "active",
    }

    await r.set(f"session:{session_id}:meta", json.dumps(meta))
    await r.rpush("sessions:all", session_id)

    return {"session_id": session_id}


@router.get("/{session_id}")
async def get_session(session_id: str):
    r = get_redis()
    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")
    return json.loads(raw)
