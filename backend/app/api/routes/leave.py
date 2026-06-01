"""Leave management routes."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.employee import Employee
from app.models.leave import Leave, LeaveBalance, LeaveStatus, LeaveType
from app.models.notification import Notification
from app.models.user import User
from app.schemas import LeaveApply, LeaveBalanceOut, LeaveOut

router = APIRouter(prefix="/leave", tags=["leave"])


async def _get_my_employee(db: AsyncSession, user: User) -> Employee:
    res = await db.execute(select(Employee).where(Employee.user_id == user.id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    return emp


def _leave_to_out(leave: Leave, employee_name: str = None) -> LeaveOut:
    return LeaveOut(
        id=str(leave.id),
        employee_id=str(leave.employee_id),
        employee_name=employee_name,
        leave_type=leave.leave_type,
        start_date=leave.start_date,
        end_date=leave.end_date,
        days_count=leave.days_count,
        reason=leave.reason,
        status=leave.status,
        applied_at=leave.applied_at,
    )


@router.post("/apply", response_model=LeaveOut, status_code=201)
async def apply_leave(
    payload: LeaveApply,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if payload.leave_type not in [t.value for t in LeaveType]:
        raise HTTPException(status_code=400, detail="Invalid leave_type")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    emp = await _get_my_employee(db, user)
    days = (payload.end_date - payload.start_date).days + 1
    leave = Leave(
        employee_id=emp.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days_count=days,
        reason=payload.reason,
        status=LeaveStatus.pending,
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    return _leave_to_out(leave, user.full_name)


@router.get("/my", response_model=list[LeaveOut])
async def my_leaves(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = await _get_my_employee(db, user)
    res = await db.execute(select(Leave).where(Leave.employee_id == emp.id).order_by(Leave.applied_at.desc()))
    return [_leave_to_out(l, user.full_name) for l in res.scalars().all()]


@router.get("/pending", response_model=list[LeaveOut])
async def pending_leaves(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("management_admin", "senior_manager")),],
):
    stmt = select(Leave, Employee, User).join(Employee, Leave.employee_id == Employee.id).join(User, Employee.user_id == User.id).where(Leave.status == LeaveStatus.pending)
    if user.role == "senior_manager":
        mgr_res = await db.execute(select(Employee).where(Employee.user_id == user.id))
        mgr = mgr_res.scalar_one_or_none()
        if mgr:
            stmt = stmt.where(Employee.manager_id == mgr.id)
    stmt = stmt.order_by(Leave.applied_at.desc())
    res = await db.execute(stmt)
    items = []
    for leave, _emp, u in res.all():
        items.append(_leave_to_out(leave, u.full_name))
    return items


async def _decide(db: AsyncSession, user: User, leave_id: str, new_status: LeaveStatus, title: str):
    res = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = res.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status != LeaveStatus.pending:
        raise HTTPException(status_code=409, detail=f"Leave already {leave.status}")
    leave.status = new_status
    leave.approved_by = user.id
    leave.approved_at = datetime.now(timezone.utc)
    # update balance if approved
    if new_status == LeaveStatus.approved:
        bal_res = await db.execute(select(LeaveBalance).where(and_(LeaveBalance.employee_id == leave.employee_id, LeaveBalance.leave_type == leave.leave_type)))
        bal = bal_res.scalar_one_or_none()
        if bal:
            bal.used_days = (bal.used_days or 0) + leave.days_count
    emp_res = await db.execute(select(Employee).where(Employee.id == leave.employee_id))
    emp = emp_res.scalar_one_or_none()
    if emp:
        db.add(Notification(
            user_id=emp.user_id,
            type="leave",
            title=title,
            message=f"Your {leave.leave_type} leave from {leave.start_date} to {leave.end_date} has been {new_status.value}.",
        ))
    await db.commit()
    await db.refresh(leave)
    return _leave_to_out(leave)


@router.put("/{leave_id}/approve", response_model=LeaveOut)
async def approve_leave(
    leave_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("management_admin", "senior_manager"))],
):
    return await _decide(db, user, leave_id, LeaveStatus.approved, "Leave Approved")


@router.put("/{leave_id}/reject", response_model=LeaveOut)
async def reject_leave(
    leave_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("management_admin", "senior_manager"))],
):
    return await _decide(db, user, leave_id, LeaveStatus.rejected, "Leave Rejected")


@router.get("/balance/{employee_id}", response_model=list[LeaveBalanceOut])
async def leave_balance(
    employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if user.role == "employee" and emp.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    bal_res = await db.execute(select(LeaveBalance).where(LeaveBalance.employee_id == employee_id))
    out = []
    for b in bal_res.scalars().all():
        out.append(LeaveBalanceOut(
            leave_type=b.leave_type,
            total_days=b.total_days,
            used_days=b.used_days,
            remaining_days=max(0, (b.total_days or 0) - (b.used_days or 0)),
        ))
    return out
