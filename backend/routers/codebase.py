from fastapi import APIRouter
from pydantic import BaseModel

from services.codebase_generator import generate_codebase

router = APIRouter(prefix="/codebase", tags=["codebase"])


class GenerateCodebaseRequest(BaseModel):
    jd_text: str
    hm_spec: str = ""
    technologies: list[str] = []


@router.post("/generate")
async def generate(body: GenerateCodebaseRequest):
    """
    Generate a per-assessment codebase from a job description and optional
    hiring-manager specification.

    Returns the generated files plus the reconciled spec (merged_spec) that
    should be stored on the assessment row as codebase_spec, and seam_topics
    which feed into the assessment's rubric_topics.
    """
    return await generate_codebase(
        jd_text=body.jd_text,
        hm_spec=body.hm_spec,
        technologies=body.technologies,
    )
