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
        f"Hi {meta['candidate_name']}, I'm your AI technical interviewer. "
        f"Today's session is {meta['problem_title']}. "
        f"You have the codebase open in front of you. "
        f"Walk me through how it works, explain the key decisions you see, and ask me if you get stuck. "
        f"Go ahead whenever you're ready."
    )

    from services.tts import synthesize
    from services.agent import log_agent_turn

    intro_audio = await synthesize(intro)
    if intro_audio:
        await websocket.send_json({"type": "agent_audio", "audio_b64": intro_audio})
    else:
        await websocket.send_json({"type": "agent_intro", "text": intro})

    # Seed conversation history with the agent's opening turn
    await log_agent_turn(session_id, r, intro)

    # Queue bridges Deepgram async callbacks → our async agent logic.
    # Buffers is_final segments and flushes on UtteranceEnd.
    transcript_queue: asyncio.Queue[str | None] = asyncio.Queue()
    utterance_buffer: list[str] = []

    deepgram = DeepgramClient(DEEPGRAM_API_KEY)
    dg_connection = deepgram.listen.asyncwebsocket.v("1")

    async def on_transcript(self, result, **kwargs):
        try:
            sentence = result.channel.alternatives[0].transcript
            if not sentence:
                return
            if result.is_final:
                utterance_buffer.append(sentence)
                print(f"[transcript] buffered: {sentence!r}")
            else:
                await websocket.send_json({"type": "transcript_chunk", "text": sentence, "is_final": False})
        except Exception as e:
            print(f"[transcript] error: {e}")

    async def on_utterance_end(self, **kwargs):
        try:
            if not utterance_buffer:
                return
            full_utterance = " ".join(utterance_buffer).strip()
            utterance_buffer.clear()
            if full_utterance:
                print(f"[utterance_end] flushing: {full_utterance!r}")
                await transcript_queue.put(full_utterance)
        except Exception as e:
            print(f"[utterance_end] error: {e}")

    dg_connection.on(LiveTranscriptionEvents.Transcript, on_transcript)
    dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)

    options = LiveOptions(
        model="nova-2",
        language="en-US",
        punctuate=True,
        interim_results=True,
        utterance_end_ms="1500",
        vad_events=True,
        encoding="linear16",
        sample_rate=16000,
    )

    await dg_connection.start(options)

    async def agent_loop():
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
                if response:
                    from services.tts import synthesize
                    audio_b64 = await synthesize(response)

                    if audio_b64:
                        await websocket.send_json({
                            "type": "agent_audio",
                            "audio_b64": audio_b64,
                        })
                    await websocket.send_json({"type": "agent_response", "text": response})

                    if await r.get(f"session:{session_id}:interview_complete"):
                        await websocket.send_json({"type": "interview_complete"})
            except Exception as e:
                print(f"[agent] error: {e}")

    async def keepalive_loop():
        """Send a KeepAlive to Deepgram every 10s so it doesn't time out during silence."""
        while True:
            await asyncio.sleep(10)
            try:
                await dg_connection.keep_alive()
            except Exception:
                break

    agent_task = asyncio.create_task(agent_loop())
    keepalive_task = asyncio.create_task(keepalive_loop())

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            elif message.get("bytes"):
                # Always forward mic audio — keeps Deepgram connection alive
                await dg_connection.send(message["bytes"])
            elif message.get("text"):
                pass  # no client→server text messages needed right now
    except WebSocketDisconnect:
        pass
    finally:
        keepalive_task.cancel()
        await transcript_queue.put(None)
        await agent_task
        await dg_connection.finish()
