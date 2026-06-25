import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from services.redis_client import ping
from routers import session, interview, snapshot, session_end, dashboard, video, challenge


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not await ping():
        raise RuntimeError("Redis connection failed on startup")
    print("Redis connected")
    yield


app = FastAPI(title="Talkode Voice Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(session.router)
app.include_router(interview.router)
app.include_router(snapshot.router)
app.include_router(session_end.router)
app.include_router(dashboard.router)
app.include_router(video.router)
app.include_router(challenge.router)


@app.get("/health")
async def health():
    redis_ok = await ping()
    return {"status": "ok", "redis": redis_ok}
