"""Sentiment Pulse Engine — /api/v1/ai/sentiment/"""
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.employee import Department, Employee
from app.models.sentiment import SentimentCheckIn
from app.models.user import User

logger = logging.getLogger("hrms.ai.sentiment")

router = APIRouter(prefix="/ai", tags=["AI - Sentiment"])


class CheckInRequest(BaseModel):
    mood_text: str


# ── Submit check-in ───────────────────────────────────────────────────────────

@router.post("/sentiment/checkin/")
async def submit_checkin(
    req: CheckInRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(get_current_user),
):
    """Any employee submits their weekly mood check-in. Analyzed by Gemini."""
    if not req.mood_text.strip():
        raise HTTPException(status_code=422, detail="mood_text cannot be empty")

    now = datetime.now(timezone.utc)
    week_num = now.isocalendar()[1]
    year = now.year

    # Resolve employee record
    emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    employee = emp_res.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee record not found")

    # One check-in per week enforcement
    existing_res = await db.execute(
        select(SentimentCheckIn).where(
            SentimentCheckIn.employee_id == str(employee.id),
            SentimentCheckIn.week_number == week_num,
            SentimentCheckIn.year == year,
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Already submitted check-in this week",
            headers={"X-Error-Code": "already_submitted"},
        )

    # OpenRouter sentiment analysis
    from app.core.openrouter import chat_json, MODEL_SMART
    prompt = (
        'Analyze this employee workplace check-in message.\n'
        'Return ONLY valid JSON, no markdown, no backticks:\n'
        '{"sentiment_score": 0.5, "sentiment_label": "positive", "key_themes": ["theme1", "theme2"]}\n\n'
        'Rules:\n'
        '- sentiment_score: float between -1.0 (very negative) and 1.0 (very positive)\n'
        '- sentiment_label: exactly one of: positive neutral negative burnout\n'
        '- key_themes: array of max 3 short strings (2-4 words each)\n\n'
        f'Message: {req.mood_text}'
    )

    try:
        parsed = await chat_json(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL_SMART,
            max_tokens=200,
        )
    except Exception as e:
        logger.error(f"OpenRouter sentiment analysis failed: {e}")
        raise HTTPException(status_code=502, detail="AI sentiment analysis failed. Try again.")

    checkin = SentimentCheckIn(
        employee_id=str(employee.id),
        week_number=week_num,
        year=year,
        mood_text=req.mood_text,
        sentiment_score=float(parsed.get("sentiment_score", 0.0)),
        sentiment_label=parsed.get("sentiment_label", "neutral"),
        key_themes=parsed.get("key_themes", []),
    )
    db.add(checkin)
    await db.commit()

    return {
        "message": "Check-in submitted",
        "sentiment_label": checkin.sentiment_label,
        "sentiment_score": checkin.sentiment_score,
        "key_themes": checkin.key_themes,
    }


# ── Team pulse (admin / manager) ──────────────────────────────────────────────

@router.get("/sentiment/pulse/")
async def get_sentiment_pulse(
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin", "senior_manager")),
):
    """
    Return aggregated sentiment heatmap data.
    Grouped by (department, week_number, year).
    Returns last 8 weeks of data.
    """
    now = datetime.now(timezone.utc)
    current_week = now.isocalendar()[1]
    current_year = now.year

    # Build last 8 week numbers (handles year boundary)
    weeks = []
    for i in range(7, -1, -1):
        wk = current_week - i
        yr = current_year
        while wk <= 0:
            wk += 52
            yr -= 1
        weeks.append((wk, yr))

    week_nums = [w for w, _ in weeks]

    # Join checkins → employees → departments
    stmt = (
        select(SentimentCheckIn, Employee, Department)
        .join(Employee, SentimentCheckIn.employee_id == Employee.id)
        .join(Department, Employee.department_id == Department.id)
        .where(SentimentCheckIn.week_number.in_(week_nums))
    )

    # Manager sees only their team
    if current_user.role == "senior_manager":
        mgr_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        mgr = mgr_res.scalar_one_or_none()
        if mgr:
            stmt = stmt.where(Employee.manager_id == str(mgr.id))

    rows = (await db.execute(stmt)).all()

    # Group by (week_number, year, dept_name)
    grouped: dict = {}
    for checkin, emp, dept in rows:
        key = (checkin.week_number, checkin.year, dept.name)
        if key not in grouped:
            grouped[key] = {"scores": [], "labels": [], "themes": [], "count": 0}
        grouped[key]["scores"].append(checkin.sentiment_score)
        grouped[key]["labels"].append(checkin.sentiment_label)
        grouped[key]["themes"].extend(checkin.key_themes or [])
        grouped[key]["count"] += 1

    pulse = []
    for (week, year, dept_name), data in grouped.items():
        most_common_label = Counter(data["labels"]).most_common(1)[0][0]
        avg = round(sum(data["scores"]) / len(data["scores"]), 2)
        pulse.append({
            "week_number": week,
            "year": year,
            "department_name": dept_name,
            "avg_sentiment": avg,
            "label": most_common_label,
            "response_count": data["count"],
            "key_themes": list(set(data["themes"]))[:5],
        })

    # Sort chronologically
    week_order = {(w, y): i for i, (w, y) in enumerate(weeks)}
    pulse.sort(key=lambda x: (week_order.get((x["week_number"], x["year"]), 99), x["department_name"]))

    return pulse


# ── My sentiment history ──────────────────────────────────────────────────────

@router.get("/sentiment/my/")
async def get_my_sentiment(
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(get_current_user),
):
    """Return the current user's last 8 weekly check-ins."""
    emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    employee = emp_res.scalar_one_or_none()
    if not employee:
        return []

    res = await db.execute(
        select(SentimentCheckIn)
        .where(SentimentCheckIn.employee_id == str(employee.id))
        .order_by(SentimentCheckIn.created_at.desc())
        .limit(8)
    )
    checkins = res.scalars().all()
    return [
        {
            "id": str(c.id),
            "week_number": c.week_number,
            "year": c.year,
            "sentiment_label": c.sentiment_label,
            "sentiment_score": c.sentiment_score,
            "key_themes": c.key_themes,
            "created_at": c.created_at.isoformat(),
        }
        for c in checkins
    ]
