import json
import os
import time

import redis.asyncio as redis
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

# Rule-gate phrase lists
STUCK_PHRASES = ["i'm stuck", "im stuck", "i don't know", "i dont know", "not sure how", "don't know how", "no idea how", "i don't understand", "i dont understand", "i'm confused", "i'm lost", "i don't get it", "not sure what"]
HINT_PHRASES = ["can i get a hint", "give me a hint", "is this the right direction", "what should i look at", "am i on the right track"]
QUESTION_SIGNALS = ["should i", "what if", "does this need", "do i need", "how do i", "what do i", "how should i", "how would i", "how can i", "what's the best", "what is the best", "?"]
DECISION_PHRASES = ["i'll go with", "i'll use", "i'm going to use", "i'm choosing", "i'll choose"]


def rule_gate(text: str) -> str | None:
    lower = text.lower()
    for phrase in STUCK_PHRASES:
        if phrase in lower:
            return "stuck"
    for phrase in HINT_PHRASES:
        if phrase in lower:
            return "hint_request"
    for phrase in DECISION_PHRASES:
        if phrase in lower:
            return "decision"
    for phrase in QUESTION_SIGNALS:
        if phrase in lower:
            return "question"
    return None


async def get_rolling_window(session_id: str, r: redis.Redis, window_seconds: int = 40) -> str:
    # Pull last 50 chunks, filter to window
    raw_chunks = await r.lrange(f"session:{session_id}:transcript_chunks", -50, -1)
    cutoff_ms = int(time.time() * 1000) - (window_seconds * 1000)
    texts = [
        json.loads(c)["text"]
        for c in raw_chunks
        if json.loads(c)["timestamp_ms"] >= cutoff_ms
    ]
    return " ".join(texts)


async def get_rolling_memory(session_id: str, r: redis.Redis) -> str:
    # Short list of what the agent has already covered this session
    items = await r.lrange(f"session:{session_id}:memory_notes", 0, -1)
    return "; ".join(items) if items else "Nothing covered yet."


async def maybe_respond(session_id: str, r: redis.Redis) -> str | None:
    window = await get_rolling_window(session_id, r)
    if not window:
        return None

    trigger = rule_gate(window)
    print(f"[rule-gate] window: {window!r} → trigger: {trigger}")
    if not trigger:
        return None

    # Pull context for the LLM call
    meta_raw = await r.get(f"session:{session_id}:meta")
    if not meta_raw:
        return None
    meta = json.loads(meta_raw)

    code_raw = await r.get(f"session:{session_id}:latest_code")
    code_snapshot = code_raw or "(no code written yet)"

    memory_notes = await get_rolling_memory(session_id, r)

    prompt = f"""You are a senior engineer sitting with a candidate during a technical interview. Here is the problem they are solving:
{meta["problem_statement"]}

Their current code:
{code_snapshot}

What the candidate just said (ignore any transcription noise):
"{window}"

Already covered this session: {memory_notes}

Your job: if the candidate asked ANY question or expressed confusion or being stuck, respond helpfully and briefly — 1-3 sentences max, like a real mentor nudging them in the right direction, not giving the answer away. Be direct and practical.

Only respond with exactly the word NONE (nothing else) if the candidate is clearly just thinking out loud with no question or confusion expressed at all."""

    print(f"[openai] calling with problem={meta['problem_title']!r} trigger window={window[-100:]!r}")
    print(f"[openai] code_snapshot={code_snapshot[:200]!r}")
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.4,
    )

    text = response.choices[0].message.content.strip()
    print(f"[openai] raw response: {text!r}")
    if text == "NONE":
        return None

    # Log the event and update memory notes
    event = {
        "type": "agent_response",
        "t_start": time.time(),
        "t_end": time.time(),
        "quote": window[-200:],  # last 200 chars of window as the trigger quote
        "label": text,
    }
    await r.rpush(f"session:{session_id}:events", json.dumps(event))
    await r.rpush(f"session:{session_id}:memory_notes", text[:100])

    return text
