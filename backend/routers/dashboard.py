import json

from fastapi import APIRouter, HTTPException

from services.redis_client import get_redis

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/sessions")
async def list_sessions():
    r = get_redis()
    session_ids = await r.lrange("sessions:all", 0, -1)

    sessions = []
    for sid in session_ids:
        raw = await r.get(f"session:{sid}:meta")
        if raw:
            sessions.append(json.loads(raw))

    return {"sessions": sessions}


@router.get("/session/{session_id}/events")
async def get_events(session_id: str):
    r = get_redis()

    if not await r.exists(f"session:{session_id}:meta"):
        raise HTTPException(status_code=404, detail="Session not found")

    raw_events = await r.lrange(f"session:{session_id}:events", 0, -1)
    events = [json.loads(e) for e in raw_events]

    return {"session_id": session_id, "events": events}


@router.get("/session/{session_id}/timeline")
async def get_timeline(session_id: str):
    r = get_redis()

    raw = await r.get(f"session:{session_id}:timeline")
    if not raw:
        raise HTTPException(status_code=404, detail="Timeline not ready — session may still be processing")

    return {"session_id": session_id, "timeline": json.loads(raw)}


@router.get("/session/{session_id}/insights")
async def get_insights(session_id: str):
    r = get_redis()

    if not await r.exists(f"session:{session_id}:meta"):
        raise HTTPException(status_code=404, detail="Session not found")

    raw = await r.get(f"session:{session_id}:insights")
    if not raw:
        raise HTTPException(status_code=404, detail="Insights not ready yet")

    return {"session_id": session_id, "insights": json.loads(raw)}
