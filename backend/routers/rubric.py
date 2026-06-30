import json
import os

from fastapi import APIRouter
from openai import AsyncOpenAI
from pydantic import BaseModel

router = APIRouter(prefix="/rubric", tags=["rubric"])

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


class ExtractTopicsRequest(BaseModel):
    rubric_text: str


@router.post("/extract-topics")
async def extract_topics(body: ExtractTopicsRequest):
    """Categorize a rubric into a canonical topic list, once, at creation time.

    Grading still happens against the full rubric text — this list only
    exists so every session reports scores against the same fixed set of
    topics regardless of how the rubric was formatted (headings, bullets,
    free-form prose, etc.)."""
    rubric = body.rubric_text.strip()
    if not rubric:
        return {"topics": []}

    prompt = f"""You are parsing a technical interview rubric into a clean list of evaluation topics.

Rubric:
{rubric}

Return the distinct competency areas a candidate should be scored on — short titles (3-6 words each), in the
order they appear in the rubric. Skip meta-sections like interview flow, instructions, scoring scale, or
general overview — only include actual things a candidate gets evaluated on. Do not invent topics that aren't
implied by the rubric content.

Return JSON: {{"topics": ["...", "..."]}}"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
    )
    data = json.loads(response.choices[0].message.content)
    topics = data.get("topics", [])
    return {"topics": [t for t in topics if isinstance(t, str) and t.strip()]}
