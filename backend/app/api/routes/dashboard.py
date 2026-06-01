"""Dashboards: aggregated metrics per role."""
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.attendance import Attendance
from app.models.employee import Department, Employee
from app.models.leave import Leave, LeaveBalance, LeaveStatus
from app.models.payroll import Payroll, PayrollStatus
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/admin")
async def admin_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    today = date.today()
    total_employees = (await db.execute(select(func.count(Employee.id)).where(Employee.is_active.is_(True)))).scalar() or 0
    present_today = (await db.execute(select(func.count(Attendance.id)).where(Attendance.date == today))).scalar() or 0
    pending_leaves = (await db.execute(select(func.count(Leave.id)).where(Leave.status == LeaveStatus.pending))).scalar() or 0

    payroll_total = (await db.execute(
        select(func.coalesce(func.sum(Payroll.net_salary), 0)).where(
            Payroll.month == today.month,
            Payroll.year == today.year,
            Payroll.status.in_([PayrollStatus.processed, PayrollStatus.paid]),
        )
    )).scalar() or 0

    # Headcount by department
    res = await db.execute(
        select(Department.name, func.count(Employee.id))
        .join(Employee, Employee.department_id == Department.id, isouter=True)
        .group_by(Department.name)
        .order_by(Department.name)
    )
    headcount = [{"department": n or "Unassigned", "count": c} for n, c in res.all()]

    # Attendance rate last 6 months
    months = []
    for i in range(5, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        total = (await db.execute(
            select(func.count(Attendance.id)).where(
                func.extract("month", Attendance.date) == m,
                func.extract("year", Attendance.date) == y,
            )
        )).scalar() or 0
        present = (await db.execute(
            select(func.count(Attendance.id)).where(
                Attendance.status.in_(["present", "late"]),
                func.extract("month", Attendance.date) == m,
                func.extract("year", Attendance.date) == y,
            )
        )).scalar() or 0
        rate = round((present / total * 100) if total else 0, 1)
        months.append({"label": date(y, m, 1).strftime("%b %y"), "rate": rate})

    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "pending_leaves": pending_leaves,
        "payroll_total": float(payroll_total),
        "headcount_by_department": headcount,
        "attendance_trend": months,
    }


@router.get("/manager")
async def manager_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("senior_manager", "management_admin"))],
):
    today = date.today()
    mgr_res = await db.execute(select(Employee).where(Employee.user_id == user.id))
    mgr = mgr_res.scalar_one_or_none()
    if not mgr:
        return {"team_size": 0, "present_today": 0, "pending_approvals": 0, "team": []}
    team_res = await db.execute(select(Employee).where(Employee.manager_id == mgr.id))
    team = team_res.scalars().unique().all()
    emp_ids = [e.id for e in team]
    present_today = 0
    pending = 0
    if emp_ids:
        present_today = (await db.execute(
            select(func.count(Attendance.id)).where(Attendance.employee_id.in_(emp_ids), Attendance.date == today)
        )).scalar() or 0
        pending = (await db.execute(
            select(func.count(Leave.id)).where(Leave.employee_id.in_(emp_ids), Leave.status == LeaveStatus.pending)
        )).scalar() or 0
    return {
        "team_size": len(team),
        "present_today": present_today,
        "pending_approvals": pending,
        "team": [{"id": str(e.id), "full_name": e.user.full_name if e.user else "", "designation": e.designation} for e in team],
    }


@router.get("/employee")
async def employee_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    today = date.today()
    emp_res = await db.execute(select(Employee).where(Employee.user_id == user.id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        return {"clocked_in": False, "leave_balances": [], "recent_leaves": []}
    att_res = await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.date == today))
    att = att_res.scalar_one_or_none()
    bal_res = await db.execute(select(LeaveBalance).where(LeaveBalance.employee_id == emp.id))
    bals = [
        {
            "leave_type": b.leave_type,
            "total_days": b.total_days,
            "used_days": b.used_days,
            "remaining_days": max(0, b.total_days - b.used_days),
        }
        for b in bal_res.scalars().all()
    ]
    leaves_res = await db.execute(
        select(Leave).where(Leave.employee_id == emp.id).order_by(Leave.applied_at.desc()).limit(5)
    )
    recent_leaves = [
        {
            "id": str(l.id),
            "leave_type": l.leave_type,
            "start_date": l.start_date.isoformat(),
            "end_date": l.end_date.isoformat(),
            "status": l.status,
            "days_count": l.days_count,
        }
        for l in leaves_res.scalars().all()
    ]
    return {
        "employee_id": str(emp.id),
        "employee_code": emp.employee_code,
        "designation": emp.designation,
        "department_name": emp.department.name if emp.department else None,
        "clocked_in": bool(att and att.clock_in and not att.clock_out),
        "clock_in_time": att.clock_in.isoformat() if att and att.clock_in else None,
        "clock_out_time": att.clock_out.isoformat() if att and att.clock_out else None,
        "leave_balances": bals,
        "recent_leaves": recent_leaves,
    }


@router.get("/recruiter")
async def recruiter_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("hr_recruiter", "management_admin"))],
):
    from app.models.recruitment import Candidate, CandidateStatus, JobPosting, JobStatus
    open_jobs = (await db.execute(select(func.count(JobPosting.id)).where(JobPosting.status == JobStatus.open))).scalar() or 0
    total_candidates = (await db.execute(select(func.count(Candidate.id)))).scalar() or 0
    interviews = (await db.execute(select(func.count(Candidate.id)).where(Candidate.status == CandidateStatus.interview))).scalar() or 0
    pipe_rows = await db.execute(select(Candidate.status, func.count(Candidate.id)).group_by(Candidate.status))
    pipeline = [{"stage": s, "count": c} for s, c in pipe_rows.all()]
    jobs_rows = await db.execute(select(JobPosting).order_by(JobPosting.created_at.desc()).limit(5))
    recent_jobs = [
        {"id": str(j.id), "title": j.title, "status": j.status, "created_at": j.created_at.isoformat()}
        for j in jobs_rows.scalars().all()
    ]
    return {
        "open_jobs": open_jobs,
        "total_candidates": total_candidates,
        "interviews": interviews,
        "interviews_this_week": interviews,  # backward compatible
        "pipeline": pipeline,
        "recent_jobs": recent_jobs,
    }
