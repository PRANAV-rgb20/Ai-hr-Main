"""ML-based Performance Predictor and Attrition Risk Scorer — /api/v1/ai/"""
import asyncio
import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus
from app.models.performance import PerformanceReview
from app.models.user import User

logger = logging.getLogger("hrms.ai.predictions")

router = APIRouter(prefix="/ai", tags=["AI - Predictions"])

# Simple in-memory cache for expensive team attrition calls
_attrition_cache: dict[str, tuple[float, dict]] = {}
_ATTRITION_TTL = 60  # seconds


# ── Feature extraction ────────────────────────────────────────────────────────

async def _get_employee_features(employee_id: str, db: AsyncSession) -> dict:
    """Derive ML features from live DB data for a given employee."""
    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Tenure
    tenure_months = 12
    if emp.date_of_joining:
        tenure_months = max(1, (date.today() - emp.date_of_joining).days // 30)

    # Attendance rate — last 90 days
    ninety_ago = datetime.now(timezone.utc) - timedelta(days=90)
    att_res = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.clock_in >= ninety_ago,
        )
    )
    att_records = att_res.scalars().all()
    total_att = len(att_records)
    present = sum(
        1 for a in att_records
        if a.status in (AttendanceStatus.present, AttendanceStatus.late)
    )
    attendance_rate = (present / total_att) if total_att > 0 else 0.75

    # Leave days — last 90 days
    leave_res = await db.execute(
        select(Leave).where(
            Leave.employee_id == employee_id,
            Leave.status == LeaveStatus.approved,
            Leave.applied_at >= ninety_ago,
        )
    )
    leaves = leave_res.scalars().all()
    leave_days = sum(l.days_count for l in leaves)
    leave_frequency = min(leave_days / 90, 1.0)

    # Performance reviews — last 2
    perf_res = await db.execute(
        select(PerformanceReview)
        .where(PerformanceReview.employee_id == employee_id)
        .order_by(PerformanceReview.created_at.desc())
        .limit(2)
    )
    reviews = perf_res.scalars().all()
    peer_rating = (reviews[0].overall_score / 2.0) if reviews else 3.5  # scale 0-10 → 0-5

    perf_trend = 0.0
    if len(reviews) >= 2:
        perf_trend = (reviews[0].overall_score - reviews[1].overall_score) / 10.0

    return {
        "employee": emp,
        "tenure_months": tenure_months,
        "attendance_rate": round(attendance_rate, 2),
        "leave_days": leave_days,
        "leave_frequency": round(leave_frequency, 2),
        "peer_rating": round(peer_rating, 1),
        "tasks_completed": 0.70,   # default — no task tracking model yet
        "perf_trend": round(perf_trend, 2),
        "sentiment_avg": 0.0,      # default — no sentiment model yet
        "salary_growth": 0.05,     # default — no salary history yet
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/predict-performance/{employee_id}/")
async def predict_employee_performance(
    employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin", "senior_manager")),
):
    """Predict performance score for a single employee using ML model."""
    from app.ai.ml_models import predict_performance

    features = await _get_employee_features(employee_id, db)
    result = await asyncio.to_thread(
        predict_performance,
        features["attendance_rate"],
        features["tasks_completed"],
        features["peer_rating"],
        features["leave_days"],
        features["tenure_months"],
    )
    emp = features["employee"]
    return {
        "employee_id": employee_id,
        "employee_name": emp.user.full_name if emp.user else "Unknown",
        "features_used": {
            "attendance_rate": features["attendance_rate"],
            "leave_days": features["leave_days"],
            "peer_rating": features["peer_rating"],
            "tenure_months": features["tenure_months"],
        },
        **result,
    }


@router.get("/attrition-risk/{employee_id}/")
async def get_attrition_risk(
    employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin", "senior_manager")),
):
    """Get attrition risk score for a single employee."""
    from app.ai.ml_models import predict_attrition

    features = await _get_employee_features(employee_id, db)
    result = await asyncio.to_thread(
        predict_attrition,
        features["perf_trend"],
        features["sentiment_avg"],
        features["leave_frequency"],
        features["tenure_months"],
        features["salary_growth"],
    )
    emp = features["employee"]
    return {
        "employee_id": employee_id,
        "employee_name": emp.user.full_name if emp.user else "Unknown",
        **result,
    }


@router.get("/attrition-risk/team/{manager_employee_id}/")
async def get_team_attrition_risk(
    manager_employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin", "senior_manager")),
):
    """
    Get attrition risk for all direct reports of a manager.
    Pass the manager's employee ID (not user ID).
    For admin, pass any employee ID or 'all' — all active employees are returned.
    Results are cached for 60 seconds to avoid repeated expensive ML inference.
    """
    from app.ai.ml_models import predict_attrition

    cache_key = f"attrition:team:{current_user.id}:{manager_employee_id}"
    cached = _attrition_cache.get(cache_key)
    if cached:
        ts, result = cached
        if time.monotonic() - ts < _ATTRITION_TTL:
            return result

    # Admin gets all employees; 'all' is a special sentinel from the frontend
    if current_user.role == "management_admin" or manager_employee_id == "all":
        team_res = await db.execute(
            select(Employee).where(Employee.is_active.is_(True))
        )
    else:
        team_res = await db.execute(
            select(Employee).where(
                Employee.manager_id == manager_employee_id,
                Employee.is_active.is_(True),
            )
        )
    team = team_res.scalars().unique().all()

    results = []
    for emp in team:
        try:
            features = await _get_employee_features(str(emp.id), db)
            risk = await asyncio.to_thread(
                predict_attrition,
                features["perf_trend"],
                features["sentiment_avg"],
                features["leave_frequency"],
                features["tenure_months"],
                features["salary_growth"],
            )
            results.append({
                "employee_id": str(emp.id),
                "employee_name": emp.user.full_name if emp.user else "Unknown",
                "designation": emp.designation or "",
                "department_name": emp.department.name if emp.department else "",
                **risk,
            })
        except Exception as e:
            logger.warning(f"Skipping employee {emp.id}: {e}")
            continue

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    response = {
        "team_size": len(team),
        "high_risk_count": sum(1 for r in results if r["risk_level"] == "high"),
        "results": results,
    }
    _attrition_cache[cache_key] = (time.monotonic(), response)
    return response
