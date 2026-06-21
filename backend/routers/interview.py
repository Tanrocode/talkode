import asyncio
import json
import os
import time

from deepgram import DeepgramClient, LiveOptions, LiveTranscriptionEvents
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.redis_client import get_redis

router = APIRouter(tags=["interview"])

DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")


@router.websocket("/interview/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    r = get_redis()

    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        await websocket.send_json({"type": "error", "text": "Session not found"})
        await websocket.close()
        return

    meta = json.loads(raw)

    intro = (
        f"Hi {meta['candidate_name']}, I'm your technical interviewer today. "
        f"Here's your problem:\n\n"
        f"**{meta['problem_title']}**\n\n"
        f"{meta['problem_statement']}\n\n"
        f"Take your time, think out loud, and let me know if you have any questions."
    )
    await websocket.send_json({"type": "agent_intro", "text": intro})

    # Queue bridges the Deepgram sync callback → our async agent logic
    transcript_queue: asyncio.Queue[str] = asyncio.Queue()

    deepgram = DeepgramClient(DEEPGRAM_API_KEY)
    dg_connection = deepgram.listen.asyncwebsocket.v("1")

    async def on_transcript(self, result, **kwargs):
        try:
            sentence = result.channel.alternatives[0].transcript
            if not sentence or not result.is_final:
                return
            print(f"[transcript] {sentence!r}")
            await transcript_queue.put(sentence)
        except Exception as e:
            print(f"[transcript] error: {e}")

    dg_connection.on(LiveTranscriptionEvents.Transcript, on_transcript)

    options = LiveOptions(
        model="nova-2",
        language="en-US",
        punctuate=True,
        interim_results=True,
        utterance_end_ms="2000",
        vad_events=True,
        encoding="linear16",
        sample_rate=16000,
    )

    await dg_connection.start(options)

    async def agent_loop():
        """Drains the transcript queue and runs rule-gate + LLM in our own async context."""
        from services.agent import maybe_respond
        while True:
            sentence = await transcript_queue.get()
            if sentence is None:
                break

            chunk = {"text": sentence, "timestamp_ms": int(time.time() * 1000), "is_final": True}
            await r.rpush(f"session:{session_id}:transcript_chunks", json.dumps(chunk))
            await websocket.send_json({"type": "transcript_chunk", "text": sentence, "is_final": True})

            try:
                response = await maybe_respond(session_id, r)
                print(f"[agent] response: {response!r}")
                if response:
                    await websocket.send_json({"type": "agent_response", "text": response})
            except Exception as e:
                print(f"[agent] error: {e}")

    agent_task = asyncio.create_task(agent_loop())

    try:
        async for message in websocket.iter_bytes():
            await dg_connection.send(message)
    except WebSocketDisconnect:
        pass
    finally:
        await transcript_queue.put(None)  # signal agent_loop to stop
        await agent_task
        await dg_connection.finish()
