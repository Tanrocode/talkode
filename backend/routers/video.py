from fastapi import APIRouter, File, HTTPException, UploadFile

from services import storage
from services.redis_client import get_redis

router = APIRouter(tags=["session"])


@router.post("/session/{session_id}/video")
async def upload_video(session_id: str, video: UploadFile = File(...)):
    r = get_redis()

    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")

    data = await video.read()
    stored = await storage.upload_video(
        session_id, data, video.content_type or "video/webm"
    )

    return {"stored": stored}


@router.post("/session/{session_id}/screen")
async def upload_screen_recording(session_id: str, video: UploadFile = File(...)):
    r = get_redis()

    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")

    data = await video.read()
    stored = await storage.upload_video(
        session_id, data, video.content_type or "video/webm", kind="screen"
    )

    return {"stored": stored}
