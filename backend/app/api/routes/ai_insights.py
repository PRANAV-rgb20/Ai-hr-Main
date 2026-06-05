"""AI insight endpoints for workforce narratives and wellness intelligence."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.openrouter import MODEL_SMART, chat
from app.core.redis_cache import cache_get, cache_set
from app.models.attendance import Attendance
from app.models.employee import Department, Employee
from app.models.leave import Leave, LeaveStatus
from app.models.payroll import Payroll
from app.models.performance import PerformanceReview
from app.models.sentiment import SentimentCheckIn
from app.models.user import User

logger = logging.getLogger("hrms.ai.insights")

router = APIRouter(prefix="/ai/insights", tags=["AI - Insights"])


async def _ai_summary(prompt: str, fallback: str, max_tokens: int = 220) -> str:
    try:
        result = await chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You are an HR analytics copilot. Write concise, executive-ready "
                        "workforce insights in 2-4 sentences. Avoid markdown headings."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            model=MODEL_SMART,
            max_tokens=max_tokens,
            temperature=0.45,
        )
        return result.strip()
    except Exception as exc:
        logger.warning("AI insight API call failed, using fallback: %s", exc)
        return fallback


async def _latest_reviews(db: AsyncSession, employee_id: str, limit: int = 2) -> list[PerformanceReview]:
    rows = await db.execute(
        select(PerformanceReview)
        .where(PerformanceReview.employee_id == employee_id)
        .order_by(PerformanceReview.created_at.desc())
        .limit(limit)
    )
    return rows.scalars().all()


async def _employee_wellness(db: AsyncSession, employee_id: str) -> dict:
    emp = (
        await db.execute(
            select(Employee)
            .where(Employee.id == employee_id)
            .options(selectinload(Employee.user))
        )
    ).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    today = date.today()
    ninety_ago = today - timedelta(days=90)
    attendance_rows = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.count(case((Attendance.status.in_(["present", "late"]), Attendance.id))).label("present"),
        ).where(Attendance.employee_id == employee_id, Attendance.date >= ninety_ago)
    )
    att_total, att_present = attendance_rows.one()
    attendance_rate = (att_present / att_total) if att_total else 0.78

    leave_days = (
        await db.execute(
            select(func.coalesce(func.sum(Leave.days_count), 0)).where(
                Leave.employee_id == employee_id,
                Leave.status == LeaveStatus.approved,
                Leave.start_date >= ninety_ago,
            )
        )
    ).scalar() or 0
    leave_frequency = min(float(leave_days) / 18.0, 1.0)

    sentiment = (
        await db.execute(
            select(func.avg(SentimentCheckIn.sentiment_score)).where(
                SentimentCheckIn.employee_id == employee_id,
                SentimentCheckIn.created_at >= datetime.now(timezone.utc) - timedelta(days=90),
            )
        )
    ).scalar()
    sentiment_score = 0.68 if sentiment is None else max(0.0, min(1.0, float(sentiment)))

    reviews = await _latest_reviews(db, employee_id, 2)
    latest_review = reviews[0] if reviews else None
    performance_score = (latest_review.overall_score / 10.0) if latest_review else 0.72
    performance_trend = 0.0
    if len(reviews) > 1:
        performance_trend = (reviews[0].overall_score - reviews[1].overall_score) / 10.0

    score = round(
        (
            attendance_rate * 0.30
            + sentiment_score * 0.30
            + (1.0 - leave_frequency) * 0.20
            + max(0.0, min(1.0, performance_score + performance_trend * 0.25)) * 0.20
        )
        * 100
    )
    if score >= 75:
        level = "strong"
        color = "emerald"
    elif score >= 55:
        level = "watch"
        color = "amber"
    else:
        level = "support"
        color = "rose"

    drivers = []
    if attendance_rate < 0.75:
        drivers.append("declining attendance")
    if sentiment_score < 0.55:
        drivers.append("low sentiment")
    if leave_frequency > 0.45:
        drivers.append("high leave frequency")
    if latest_review and latest_review.overall_score < 7:
        drivers.append("recent performance review below target")
    if not drivers:
        drivers.append("balanced attendance, sentiment, leave, and performance signals")

    return {
        "employee_id": employee_id,
        "employee_name": emp.user.full_name if emp.user else "Employee",
        "score": score,
        "level": level,
        "color": color,
        "drivers": drivers,
        "metrics": {
            "attendance_rate": round(attendance_rate * 100, 1),
            "sentiment_score": round(sentiment_score * 100, 1),
            "leave_frequency": round(leave_frequency * 100, 1),
            "performance_score": round(performance_score * 100, 1),
            "performance_trend": round(performance_trend * 100, 1),
        },
    }


@router.get("/admin-summary")
async def admin_ai_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    cache_key = f"ai:admin-summary:{date.today().isoformat()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    # Eagerly load user relationship to avoid async lazy-load failures
    employees = (
        await db.execute(
            select(Employee)
            .where(Employee.is_active.is_(True))
            .options(selectinload(Employee.user))
        )
    ).scalars().unique().all()
    wellness = []
    for emp in employees:
        try:
            wellness.append(await _employee_wellness(db, str(emp.id)))
        except Exception as exc:
            logger.warning("Wellness compute failed for %s: %s", emp.id, exc)
            continue

    elevated = [w for w in wellness if w["score"] < 60]
    by_dept = await db.execute(
        select(Department.name, func.avg(SentimentCheckIn.sentiment_score))
        .join(Employee, Employee.department_id == Department.id)
        .join(SentimentCheckIn, SentimentCheckIn.employee_id == Employee.id)
        .where(SentimentCheckIn.created_at >= datetime.now(timezone.utc) - timedelta(days=14))
        .group_by(Department.name)
        .order_by(func.avg(SentimentCheckIn.sentiment_score).desc())
    )
    department_sentiment = [
        {"department": name or "Unassigned", "score": round(float(score or 0) * 100, 1)}
        for name, score in by_dept.all()
    ]
    top_dept = department_sentiment[0]["department"] if department_sentiment else "Operations"
    top_risk = elevated[:3]
    common_drivers = sorted(
        {driver for item in top_risk for driver in item["drivers"]}
    ) or ["attendance, sentiment, and performance signals"]

    fallback = (
        f"{len(elevated)} employees show elevated wellness or attrition risk this week, "
        f"primarily driven by {', '.join(common_drivers[:2])}. "
        f"{top_dept} has the strongest morale signal in the latest check-ins. "
        "Managers should prioritize focused check-ins and workload balancing."
    )
    prompt = (
        "Create a natural-language admin dashboard insight using these HR signals. "
        "Mention elevated attrition/wellness risk, likely drivers, and team morale trend. "
        f"Active employees: {len(employees)}. Elevated risk employees: {len(elevated)}. "
        f"Risk drivers: {common_drivers}. Department sentiment: {department_sentiment}. "
        "Use the style: '3 employees in Engineering show elevated attrition risk this week...'"
    )
    narrative = await _ai_summary(prompt, fallback)
    result = {
        "title": "AI Insight",
        "summary": narrative,
        "elevated_count": len(elevated),
        "top_drivers": common_drivers[:4],
        "department_sentiment": department_sentiment[:5],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Cache for 30 minutes (not 8 hours) so errors don't persist all day
    await cache_set(cache_key, result, ttl_seconds=30 * 60)
    return result


@router.get("/wellness/{employee_id}")
async def wellness_score(
    employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = (
        await db.execute(select(Employee).where(Employee.id == employee_id))
    ).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if user.role == "employee" and emp.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return await _employee_wellness(db, employee_id)


@router.get("/learning-recommendations/my")
async def my_learning_recommendations(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = (
        await db.execute(select(Employee).where(Employee.user_id == user.id))
    ).scalar_one_or_none()
    if not emp:
        return {"summary": "Create your employee profile to unlock learning recommendations.", "items": []}

    reviews = await _latest_reviews(db, str(emp.id), 1)
    review = reviews[0] if reviews else None
    if review:
        raw_items = [
            ("Goal execution", review.goals_score, "Translate quarterly goals into weekly delivery milestones."),
            ("Skill depth", review.skills_score, "Build depth in the technical skills most used by your team."),
            ("Communication", review.attitude_score, "Practice concise status updates and stakeholder follow-through."),
        ]
    else:
        raw_items = [
            ("Role foundations", 7, "Review your team playbook and current process documentation."),
            ("Communication", 7, "Practice crisp updates and expectation setting."),
            ("Execution habits", 7, "Use weekly planning to keep priorities visible."),
        ]
    focus = sorted(raw_items, key=lambda item: item[1])[:3]
    fallback = (
        "Based on your latest performance signals, focus on "
        + ", ".join(item[0].lower() for item in focus)
        + ". These areas should improve confidence, delivery quality, and manager visibility."
    )
    prompt = (
        "Write 3 practical learning recommendations for an employee dashboard. "
        "Return concise prose with numbered recommendations. "
        f"Employee: {user.full_name}. Role: {emp.designation}. "
        f"Latest review: {review.period + ' ' + str(review.year) if review else 'not available'}. "
        f"Scores and focus areas: {focus}. Comments: {review.comments if review else ''}"
    )
    summary = await _ai_summary(prompt, fallback, max_tokens=260)
    return {
        "summary": summary,
        "items": [
            {"area": area, "score": score, "resource": resource}
            for area, score, resource in focus
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/payroll-narrative/{month}/{year}")
async def payroll_narrative(
    month: int,
    year: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    rows = (
        await db.execute(
            select(Payroll, Employee, Department)
            .join(Employee, Payroll.employee_id == Employee.id)
            .join(Department, Employee.department_id == Department.id, isouter=True)
            .where(Payroll.month == month, Payroll.year == year)
        )
    ).all()
    total = sum(p.net_salary for p, _e, _d in rows)
    prev_month = 12 if month == 1 else month - 1
    prev_year = year - 1 if month == 1 else year
    prev_total = (
        await db.execute(
            select(func.coalesce(func.sum(Payroll.net_salary), 0)).where(
                Payroll.month == prev_month,
                Payroll.year == prev_year,
            )
        )
    ).scalar() or 0
    change_pct = round(((total - prev_total) / prev_total * 100), 1) if prev_total else 0.0

    dept_totals: dict[str, list[float]] = {}
    salaries = [p.net_salary for p, _e, _d in rows]
    avg_salary = (sum(salaries) / len(salaries)) if salaries else 0
    anomalies = []
    for p, emp, dept in rows:
        dept_name = dept.name if dept else "Unassigned"
        dept_totals.setdefault(dept_name, []).append(p.net_salary)
        if avg_salary and (p.net_salary > avg_salary * 1.35 or p.net_salary < avg_salary * 0.65):
            anomalies.append({"employee_id": str(emp.id), "net_salary": p.net_salary})
    highest_dept = None
    highest_avg = 0
    for dept_name, values in dept_totals.items():
        dept_avg = sum(values) / len(values)
        if dept_avg > highest_avg:
            highest_dept = dept_name
            highest_avg = dept_avg

    fallback = (
        f"{datetime(year, month, 1).strftime('%B')} payroll processed for {len(rows)} employees. "
        f"Total net cost is ${total:,.0f} ({change_pct:+.1f}% vs previous month). "
        f"{highest_dept or 'The leading department'} has the highest average salary at ${highest_avg:,.0f}. "
        f"{len(anomalies)} anomalies detected; review recommended before finalizing."
    )
    prompt = (
        "Write a payroll insights narrative in 3 short sentences. "
        f"Month/year: {month}/{year}. Employee count: {len(rows)}. "
        f"Total net cost: {total}. Change vs previous month: {change_pct}%. "
        f"Highest average salary department: {highest_dept} at {highest_avg}. "
        f"Detected anomalies: {len(anomalies)}."
    )
    summary = await _ai_summary(prompt, fallback)
    return {
        "summary": summary,
        "employee_count": len(rows),
        "total_net": round(total, 2),
        "change_pct": change_pct,
        "highest_department": highest_dept,
        "highest_department_average": round(highest_avg, 2),
        "anomaly_count": len(anomalies),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
