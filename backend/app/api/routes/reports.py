"""Reports — aggregated org-wide analytics for admin."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.attendance import Attendance
from app.models.employee import Department, Employee
from app.models.leave import Leave, LeaveStatus
from app.models.payroll import Payroll
from app.models.performance import PerformanceReview
from app.models.recruitment import Candidate, JobPosting, JobStatus
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/overview")
async def overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    today = date.today()
    total_emp = (await db.execute(select(func.count(Employee.id)).where(Employee.is_active.is_(True)))).scalar() or 0
    total_dept = (await db.execute(select(func.count(Department.id)))).scalar() or 0
    open_jobs = (await db.execute(select(func.count(JobPosting.id)).where(JobPosting.status == JobStatus.open))).scalar() or 0
    total_candidates = (await db.execute(select(func.count(Candidate.id)))).scalar() or 0
    approved_leaves = (await db.execute(select(func.count(Leave.id)).where(Leave.status == LeaveStatus.approved))).scalar() or 0
    pending_leaves = (await db.execute(select(func.count(Leave.id)).where(Leave.status == LeaveStatus.pending))).scalar() or 0

    # Headcount by department
    rows = await db.execute(
        select(Department.name, func.count(Employee.id))
        .join(Employee, Employee.department_id == Department.id, isouter=True)
        .group_by(Department.name)
    )
    headcount = [{"department": n or "Unassigned", "count": c} for n, c in rows.all()]

    # Leave by type
    leave_rows = await db.execute(
        select(Leave.leave_type, func.count(Leave.id)).group_by(Leave.leave_type)
    )
    leave_by_type = [{"type": t, "count": c} for t, c in leave_rows.all()]

    # Performance avg by employee (top 5)
    perf_rows = await db.execute(
        select(User.full_name, func.avg(PerformanceReview.overall_score))
        .join(Employee, Employee.id == PerformanceReview.employee_id)
        .join(User, User.id == Employee.user_id)
        .group_by(User.full_name)
        .order_by(func.avg(PerformanceReview.overall_score).desc())
        .limit(5)
    )
    top_performers = [{"name": n, "score": round(float(s or 0), 2)} for n, s in perf_rows.all()]

    # Payroll totals last 3 months (most recent)
    pay_rows = await db.execute(
        select(Payroll.year, Payroll.month, func.sum(Payroll.net_salary), func.count(Payroll.id))
        .group_by(Payroll.year, Payroll.month)
        .order_by(Payroll.year.desc(), Payroll.month.desc())
        .limit(3)
    )
    payroll_recent = [
        {"label": f"{date(y, m, 1).strftime('%b %Y')}", "total": round(float(t or 0), 2), "count": c}
        for y, m, t, c in pay_rows.all()
    ]

    # Candidate pipeline distribution
    pipe_rows = await db.execute(select(Candidate.status, func.count(Candidate.id)).group_by(Candidate.status))
    pipeline = [{"stage": s, "count": c} for s, c in pipe_rows.all()]

    return {
        "total_employees": total_emp,
        "total_departments": total_dept,
        "open_jobs": open_jobs,
        "total_candidates": total_candidates,
        "approved_leaves": approved_leaves,
        "pending_leaves": pending_leaves,
        "headcount_by_department": headcount,
        "leave_by_type": leave_by_type,
        "top_performers": top_performers,
        "payroll_recent": payroll_recent,
        "candidate_pipeline": pipeline,
    }
