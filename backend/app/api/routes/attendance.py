"""Attendance routes."""
from datetime import date, datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee
from app.models.user import User
from app.schemas import AttendanceOut, AttendanceSummary

router = APIRouter(prefix="/attendance", tags=["attendance"])


async def _get_my_employee(db: AsyncSession, user: User) -> Employee:
    res = await db.execute(select(Employee).where(Employee.user_id == user.id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    return emp


@router.post("/clock-in", response_model=AttendanceOut)
async def clock_in(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = await _get_my_employee(db, user)
    today = date.today()
    res = await db.execute(select(Attendance).where(and_(Attendance.employee_id == emp.id, Attendance.date == today)))
    record = res.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if record and record.clock_in:
        raise HTTPException(status_code=409, detail="Already clocked in today")
    is_late = now.hour >= 10
    if record is None:
        record = Attendance(
            employee_id=emp.id,
            date=today,
            clock_in=now,
            status=AttendanceStatus.late if is_late else AttendanceStatus.present,
        )
        db.add(record)
    else:
        record.clock_in = now
        record.status = AttendanceStatus.late if is_late else AttendanceStatus.present
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/clock-out", response_model=AttendanceOut)
async def clock_out(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = await _get_my_employee(db, user)
    today = date.today()
    res = await db.execute(select(Attendance).where(and_(Attendance.employee_id == emp.id, Attendance.date == today)))
    record = res.scalar_one_or_none()
    if not record or not record.clock_in:
        raise HTTPException(status_code=400, detail="You haven't clocked in today")
    if record.clock_out:
        raise HTTPException(status_code=409, detail="Already clocked out")
    now = datetime.now(timezone.utc)
    record.clock_out = now
    delta = now - (record.clock_in.replace(tzinfo=timezone.utc) if record.clock_in.tzinfo is None else record.clock_in)
    record.work_hours = round(delta.total_seconds() / 3600.0, 2)
    if record.work_hours < 4:
        record.status = AttendanceStatus.half_day
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/my", response_model=list[AttendanceOut])
async def my_attendance(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
):
    emp = await _get_my_employee(db, user)
    today = date.today()
    m = month or today.month
    y = year or today.year
    stmt = (
        select(Attendance)
        .where(
            and_(
                Attendance.employee_id == emp.id,
                func.extract("month", Attendance.date) == m,
                func.extract("year", Attendance.date) == y,
            )
        )
        .order_by(Attendance.date)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/today")
async def today_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin", "senior_manager"))],
):
    today = date.today()
    # all active employees with today's attendance
    res = await db.execute(
        select(Employee)
        .where(Employee.is_active.is_(True))
        .options(selectinload(Employee.user), selectinload(Employee.department))
    )
    employees = res.scalars().unique().all()
    
    att_res = await db.execute(select(Attendance).where(Attendance.date == today))
    att_map = {a.employee_id: a for a in att_res.scalars().all()}
    
    # If no one has clocked in yet today (weekend/early morning), fallback to last working date
    if not att_map:
        last_date_res = await db.execute(
            select(func.max(Attendance.date)).where(
                Attendance.status.in_(["present", "late"])
            )
        )
        last_date = last_date_res.scalar()
        if last_date and last_date != today:
            today = last_date
            att_res = await db.execute(select(Attendance).where(Attendance.date == today))
            att_map = {a.employee_id: a for a in att_res.scalars().all()}

    out = []
    for e in employees:
        a = att_map.get(e.id)
        out.append(
            {
                "employee_id": str(e.id),
                "employee_code": e.employee_code,
                "full_name": e.user.full_name if e.user else "",
                "department_name": e.department.name if e.department else None,
                "clock_in": a.clock_in.isoformat() if a and a.clock_in else None,
                "clock_out": a.clock_out.isoformat() if a and a.clock_out else None,
                "status": a.status if a else "absent",
                "attendance_date": today.isoformat(),
            }
        )
    return out


@router.get("/team")
async def team_attendance(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("senior_manager", "management_admin"))],
    month: Optional[int] = None,
    year: Optional[int] = None,
):
    today = date.today()
    m, y = month or today.month, year or today.year
    if user.role == "senior_manager":
        mgr_res = await db.execute(select(Employee).where(Employee.user_id == user.id))
        mgr = mgr_res.scalar_one_or_none()
        team_q = select(Employee).where(Employee.manager_id == (mgr.id if mgr else None))
    else:
        team_q = select(Employee).where(Employee.is_active.is_(True))
    team = (await db.execute(team_q)).scalars().unique().all()
    emp_ids = [e.id for e in team]
    if not emp_ids:
        return []
    att_res = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id.in_(emp_ids),
                func.extract("month", Attendance.date) == m,
                func.extract("year", Attendance.date) == y,
            )
        )
    )
    att_list = att_res.scalars().all()
    result = []
    for e in team:
        recs = [a for a in att_list if a.employee_id == e.id]
        result.append(
            {
                "employee_id": str(e.id),
                "full_name": e.user.full_name if e.user else "",
                "employee_code": e.employee_code,
                "present": sum(1 for a in recs if a.status == "present"),
                "absent": sum(1 for a in recs if a.status == "absent"),
                "late": sum(1 for a in recs if a.status == "late"),
                "total_hours": round(sum(a.work_hours or 0 for a in recs), 2),
            }
        )
    return result


@router.get("/summary/{employee_id}", response_model=AttendanceSummary)
async def attendance_summary(
    employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    month: Optional[int] = None,
    year: Optional[int] = None,
):
    res = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if user.role == "employee" and emp.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    today = date.today()
    m, y = month or today.month, year or today.year
    stmt = select(Attendance).where(
        and_(
            Attendance.employee_id == emp.id,
            func.extract("month", Attendance.date) == m,
            func.extract("year", Attendance.date) == y,
        )
    )
    recs = (await db.execute(stmt)).scalars().all()
    return AttendanceSummary(
        present_days=sum(1 for r in recs if r.status == "present"),
        absent_days=sum(1 for r in recs if r.status == "absent"),
        late_days=sum(1 for r in recs if r.status == "late"),
        half_days=sum(1 for r in recs if r.status == "half_day"),
        total_work_hours=round(sum(r.work_hours or 0 for r in recs), 2),
    )
