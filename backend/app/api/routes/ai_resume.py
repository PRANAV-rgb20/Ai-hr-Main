"""AI Resume Screener routes — /api/v1/ai/"""
import json
import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.recruitment import Candidate
from app.models.user import User

logger = logging.getLogger("hrms.ai")

router = APIRouter(prefix="/ai", tags=["AI - Resume Screener"])


@router.post("/screen-resume/")
async def screen_single_resume(
    resume_pdf: UploadFile = File(...),
    job_description: str = Form(...),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("hr_recruiter", "management_admin")),
):
    """Screen a single PDF resume against a job description via OpenRouter."""
    if not resume_pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    if not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required")

    pdf_bytes = await resume_pdf.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    from app.ai.resume_screener import screen_resume
    try:
        result = await screen_resume(pdf_bytes, job_description)
    except json.JSONDecodeError as e:
        logger.error(f"OpenRouter returned invalid JSON: {e}")
        raise HTTPException(status_code=502, detail="AI returned an unparseable response. Try again.")
    except Exception as e:
        logger.error(f"Resume screening failed: {e}")
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")

    return result


@router.post("/screen-resume/batch/{job_id}/")
async def screen_all_candidates(
    job_id: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("hr_recruiter", "management_admin")),
):
    """Batch-screen all candidates for a job who have a resume_url."""
    import asyncio
    from app.ai.resume_screener import extract_text_from_bytes, extract_skills_spacy
    from app.core.openrouter import chat_json, MODEL_SMART

    result = await db.execute(
        select(Candidate).where(
            Candidate.job_id == job_id,
            Candidate.resume_url.isnot(None),
            Candidate.resume_url != "",
        )
    )
    candidates = result.scalars().all()
    if not candidates:
        return {"screened": 0, "results": []}

    results = []
    async with httpx.AsyncClient(timeout=30) as client:
        for candidate in candidates:
            try:
                resp = await client.get(candidate.resume_url)
                resp.raise_for_status()
                pdf_bytes = resp.content

                text   = await asyncio.to_thread(extract_text_from_bytes, pdf_bytes)
                skills = await asyncio.to_thread(extract_skills_spacy, text)

                prompt = (
                    "Analyze this resume. Return ONLY valid JSON with keys: "
                    "overall_score (int 0-100), skills_matched (array), skills_missing (array), "
                    "strengths (array 2-3), concerns (array 1-2), "
                    "recommendation (exactly: hire or maybe or reject), summary (string max 2 sentences).\n"
                    f"Detected skills: {', '.join(skills[:20])}\n"
                    f"Resume:\n{text[:3000]}"
                )

                parsed = await chat_json(
                    messages=[{"role": "user", "content": prompt}],
                    model=MODEL_SMART,
                    max_tokens=800,
                )

                candidate.ai_score            = parsed.get("overall_score")
                candidate.ai_summary          = parsed.get("summary")
                candidate.ai_skills_extracted = {
                    "matched": parsed.get("skills_matched", []),
                    "missing": parsed.get("skills_missing", []),
                }
                candidate.ai_recommendation   = parsed.get("recommendation")
                await db.commit()

                results.append({
                    "candidate_id": str(candidate.id),
                    "name":  candidate.name,
                    "email": candidate.email,
                    **parsed,
                })

            except Exception as e:
                logger.error(f"Batch screening failed for candidate {candidate.id}: {e}")
                results.append({
                    "candidate_id": str(candidate.id),
                    "name":  candidate.name,
                    "email": candidate.email,
                    "error": str(e),
                })

    results.sort(key=lambda x: x.get("overall_score", -1), reverse=True)
    return {"screened": len(candidates), "results": results}
