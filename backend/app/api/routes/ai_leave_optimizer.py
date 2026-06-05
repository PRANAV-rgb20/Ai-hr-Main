"""Smart Leave Optimizer — /api/v1/ai/leave/optimize/"""
import logging
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus
from app.models.user import User

logger = logging.getLogger("hrms.ai.leave")

router = APIRouter(prefix="/ai", tags=["AI - Leave Optimizer"])


class OptimizeRequest(BaseModel):
    duration_days: int


@router.post("/leave/optimize/")
async def optimize_leave(
    req: OptimizeRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(get_current_user),
):
    """
    Suggest 3 optimal leave windows for the requesting employee.
    Considers team absence patterns to minimise coverage gaps.
    """
    if req.duration_days < 1 or req.duration_days > 30:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="duration_days must be between 1 and 30")

    # Resolve employee
    emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    employee = emp_res.scalar_one_or_none()

    today      = date.today()
    end_window = today + timedelta(days=60)
    busy_str   = "No major team conflicts detected"

    if employee and employee.manager_id:
        # Get teammates (same manager, excluding self)
        team_res = await db.execute(
            select(Employee).where(
                Employee.manager_id == str(employee.manager_id),
                Employee.id != str(employee.id),
            )
        )
        team       = team_res.scalars().all()
        team_size  = len(team) + 1  # include self

        if team:
            team_ids = [str(e.id) for e in team]
            leave_res = await db.execute(
                select(Leave).where(
                    Leave.employee_id.in_(team_ids),
                    Leave.status.in_([LeaveStatus.approved, LeaveStatus.pending]),
                    Leave.start_date >= today,
                    Leave.start_date <= end_window,
                )
            )
            leaves = leave_res.scalars().all()

            # Count absences per calendar day
            busy: dict[str, int] = {}
            for lv in leaves:
                d = lv.start_date
                while d <= lv.end_date and d <= end_window:
                    ds = str(d)
                    busy[ds] = busy.get(ds, 0) + 1
                    d += timedelta(days=1)

            # Only flag days where >30% of team is away
            busy_periods = [
                f"{k} ({v}/{team_size} team members away)"
                for k, v in busy.items()
                if team_size > 0 and v / team_size > 0.3
            ]
            if busy_periods:
                busy_str = ", ".join(busy_periods[:10])
    else:
        team_size = 1

    # Fallback: no team data — return simple suggestions without Gemini
    if not employee or not employee.manager_id:
        suggestions = []
        start = today + timedelta(days=7)
        for i in range(3):
            # Skip to Monday if needed
            while start.weekday() >= 5:
                start += timedelta(days=1)
            end = start
            working = 0
            while working < req.duration_days:
                if end.weekday() < 5:
                    working += 1
                if working < req.duration_days:
                    end += timedelta(days=1)
            suggestions.append({
                "start_date": str(start),
                "end_date":   str(end),
                "reason":     "Good availability window — no team data to check",
            })
            start = end + timedelta(days=14)
        return {"suggestions": suggestions}

    # OpenRouter suggestion
    from app.core.openrouter import chat_json, MODEL_FAST
    prompt = (
        f"You are an HR scheduling assistant. An employee wants {req.duration_days} consecutive "
        f"working days (Mon-Fri only, skip weekends) of leave.\n"
        f"Today: {today}. Available window: {today} to {end_window}.\n"
        f"High-absence periods to avoid: {busy_str}\n\n"
        "Suggest exactly 3 optimal leave windows. "
        "Return ONLY a valid JSON array of exactly 3 objects, no markdown, no extra text:\n"
        '[{"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", '
        '"reason": "max 15 words why this window is good"}]'
    )

    try:
        suggestions = await chat_json(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL_FAST,
            max_tokens=500,
        )
        if not isinstance(suggestions, list):
            raise ValueError("Expected a JSON array")
        return {"suggestions": suggestions[:3]}
    except Exception as e:
        logger.error(f"Leave optimizer Gemini call failed: {e}")
        # Graceful fallback — return 3 simple windows
        suggestions = []
        s = today + timedelta(days=7)
        for _ in range(3):
            while s.weekday() >= 5:
                s += timedelta(days=1)
            en = s
            working = 0
            while working < req.duration_days:
                if en.weekday() < 5:
                    working += 1
                if working < req.duration_days:
                    en += timedelta(days=1)
            suggestions.append({
                "start_date": str(s),
                "end_date":   str(en),
                "reason":     "Suggested window based on your schedule",
            })
            s = en + timedelta(days=14)
        return {"suggestions": suggestions}
