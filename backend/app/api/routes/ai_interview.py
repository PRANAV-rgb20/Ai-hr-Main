"""AI Interview Bot routes — /api/v1/ai/interview/ (powered by OpenRouter)"""
import json
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.openrouter import chat, MODEL_INTERVIEW
from app.core.redis_cache import cache_delete, cache_get, cache_set
from app.models.interview import InterviewSession
from app.models.user import User

logger = logging.getLogger("hrms.ai")

router = APIRouter(prefix="/ai", tags=["AI - Interview Bot"])

SYSTEM_PROMPT = """You are an experienced HR interviewer conducting a structured interview. \
Ask exactly 8 questions one at a time. Each question should explore a different topic: \
background, technical skills, problem-solving, teamwork, leadership, communication, culture fit, career goals.

After each answer, briefly acknowledge it (1 sentence) then ask the next question.

After the candidate has answered all 8 questions, respond ONLY with this JSON (no other text, no markdown):
{{"complete": true, "scores": {{"communication": 7, "technical": 7, "culture_fit": 7, "overall": 7}}, \
"strengths": ["strength1", "strength2"], "concerns": ["concern1"], \
"recommendation": "hire"}}

recommendation must be exactly one of: hire, maybe, reject
All scores must be integers 1-10."""


# ── Pydantic request bodies ───────────────────────────────────────────────────

class StartInterviewRequest(BaseModel):
    candidate_id: str
    candidate_name: str
    job_title: str
    job_description: str = ""


class RespondRequest(BaseModel):
    session_id: str
    answer: str


# ── helpers ───────────────────────────────────────────────────────────────────

def _parse_assessment(text: str) -> dict | None:
    """Try to extract a JSON assessment block from the model reply."""
    try:
        if '"complete": true' in text or '"complete":true' in text:
            start = text.find("{")
            end   = text.rfind("}") + 1
            if start != -1 and end > start:
                return json.loads(text[start:end])
    except Exception:
        pass
    return None


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/interview/start/")
async def start_interview(
    req: StartInterviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("hr_recruiter", "management_admin")),
):
    """Create a new interview session and get the first question via OpenRouter."""
    system = SYSTEM_PROMPT.replace(
        "a structured interview",
        f"a structured interview for the role of {req.job_title}",
    )
    if req.job_description:
        system += f"\n\nJob description context:\n{req.job_description[:800]}"

    session = InterviewSession(
        candidate_id=req.candidate_id,
        candidate_name=req.candidate_name,
        job_title=req.job_title,
        conversation_history=[],
        status="in_progress",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    seed_messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": "Please begin the interview with your first question."},
    ]
    try:
        first_question = await chat(
            messages=seed_messages,
            model=MODEL_INTERVIEW,
            max_tokens=500,
            temperature=0.7,
        )
    except Exception as e:
        logger.error(f"OpenRouter interview start error: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    history = [
        {"role": "user",      "content": "Please begin the interview with your first question."},
        {"role": "assistant", "content": first_question},
    ]

    await cache_set(
        f"interview:{session.id}",
        json.dumps({"system": system, "history": history}),
        ttl_seconds=7200,
    )
    session.conversation_history = history
    await db.commit()

    return {"session_id": str(session.id), "question": first_question}


@router.post("/interview/respond/")
async def respond_to_interview(
    req: RespondRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(get_current_user),
):
    """Send candidate answer, get next question or final assessment."""
    cached = await cache_get(f"interview:{req.session_id}")
    if cached:
        data    = json.loads(cached)
        system  = data["system"]
        history = data["history"]
    else:
        result  = await db.execute(
            select(InterviewSession).where(InterviewSession.id == req.session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found")
        if session.status == "completed":
            raise HTTPException(status_code=409, detail="Interview already completed")
        system  = SYSTEM_PROMPT
        history = session.conversation_history or []

    history.append({"role": "user", "content": req.answer})

    messages = [{"role": "system", "content": system}] + history
    try:
        reply = await chat(
            messages=messages,
            model=MODEL_INTERVIEW,
            max_tokens=600,
            temperature=0.7,
        )
    except Exception as e:
        logger.error(f"OpenRouter interview respond error: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    history.append({"role": "assistant", "content": reply})

    assessment  = _parse_assessment(reply)
    is_complete = assessment is not None

    db_result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == req.session_id)
    )
    session = db_result.scalar_one_or_none()

    if session:
        session.conversation_history = history
        if is_complete:
            session.status     = "completed"
            session.assessment = assessment
            session.ended_at   = datetime.now(timezone.utc)
            await cache_delete(f"interview:{req.session_id}")
        else:
            await cache_set(
                f"interview:{req.session_id}",
                json.dumps({"system": system, "history": history}),
                ttl_seconds=7200,
            )
        await db.commit()

    if is_complete:
        return {"complete": True, "assessment": assessment}
    return {"complete": False, "question": reply}


@router.get("/interview/{session_id}/")
async def get_interview(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("hr_recruiter", "management_admin")),
):
    """Retrieve a completed or in-progress interview session."""
    result  = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id":                   str(session.id),
        "candidate_id":         str(session.candidate_id),
        "candidate_name":       session.candidate_name,
        "job_title":            session.job_title,
        "status":               session.status,
        "assessment":           session.assessment,
        "conversation_history": session.conversation_history,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at":   session.ended_at.isoformat()   if session.ended_at   else None,
    }
