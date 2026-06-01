"""Payroll routes."""
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.employee import Employee
from app.models.payroll import Payroll, PayrollStatus
from app.models.user import User
from app.schemas import PayrollOut

router = APIRouter(prefix="/payroll", tags=["payroll"])


def _calc(basic: float, hra: float, transport: float, medical: float, other: float = 0.0):
    gross = basic + hra + transport + medical
    pf = round(basic * 0.12, 2)
    tax = round(gross * 0.10, 2)
    net = round(gross - pf - tax - other, 2)
    return gross, pf, tax, net


def _to_out(p: Payroll, name: Optional[str] = None) -> PayrollOut:
    return PayrollOut(
        id=str(p.id),
        employee_id=str(p.employee_id),
        employee_name=name,
        month=p.month,
        year=p.year,
        basic_salary=p.basic_salary,
        hra=p.hra,
        transport_allowance=p.transport_allowance,
        medical_allowance=p.medical_allowance,
        gross_salary=p.gross_salary,
        pf_deduction=p.pf_deduction,
        tax_deduction=p.tax_deduction,
        other_deductions=p.other_deductions,
        net_salary=p.net_salary,
        status=p.status,
        generated_at=p.generated_at,
    )


@router.post("/generate/{month}/{year}", response_model=list[PayrollOut])
async def generate(
    month: int,
    year: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    if month < 1 or month > 12 or year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="Invalid month/year")
    emps = (await db.execute(select(Employee).where(Employee.is_active.is_(True)))).scalars().unique().all()
    out = []
    for e in emps:
        existing = (await db.execute(
            select(Payroll).where(and_(Payroll.employee_id == e.id, Payroll.month == month, Payroll.year == year))
        )).scalar_one_or_none()
        if existing:
            out.append(_to_out(existing, e.user.full_name if e.user else None))
            continue
        # Salary scaffold based on role
        basic = 8000.0 if e.user and e.user.role == "management_admin" else 6000.0 if e.user and e.user.role == "senior_manager" else 5000.0 if e.user and e.user.role == "hr_recruiter" else 4000.0
        hra = round(basic * 0.4, 2)
        transport = 200.0
        medical = 150.0
        gross, pf, tax, net = _calc(basic, hra, transport, medical, 0.0)
        p = Payroll(
            employee_id=e.id,
            month=month,
            year=year,
            basic_salary=basic,
            hra=hra,
            transport_allowance=transport,
            medical_allowance=medical,
            gross_salary=gross,
            pf_deduction=pf,
            tax_deduction=tax,
            other_deductions=0.0,
            net_salary=net,
            status=PayrollStatus.processed,
        )
        db.add(p)
        await db.flush()
        out.append(_to_out(p, e.user.full_name if e.user else None))
    await db.commit()
    return out


@router.get("/my", response_model=list[PayrollOut])
async def my_payslips(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp_res = await db.execute(select(Employee).where(Employee.user_id == user.id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        return []
    res = await db.execute(
        select(Payroll).where(Payroll.employee_id == emp.id).order_by(Payroll.year.desc(), Payroll.month.desc())
    )
    return [_to_out(p, user.full_name) for p in res.scalars().all()]


@router.get("/{payroll_id}", response_model=PayrollOut)
async def get_payslip(
    payroll_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found")
    emp_res = await db.execute(select(Employee).where(Employee.id == p.employee_id))
    emp = emp_res.scalar_one_or_none()
    if user.role == "employee" and (not emp or emp.user_id != user.id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return _to_out(p, emp.user.full_name if emp and emp.user else None)


@router.put("/{payroll_id}/mark-paid", response_model=PayrollOut)
async def mark_paid(
    payroll_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    res = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found")
    p.status = PayrollStatus.paid
    await db.commit()
    await db.refresh(p)
    return _to_out(p)


@router.get("/summary/{month}/{year}")
async def summary(
    month: int,
    year: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    res = await db.execute(
        select(Payroll).where(Payroll.month == month, Payroll.year == year)
    )
    items = res.scalars().all()
    return {
        "month": month,
        "year": year,
        "count": len(items),
        "total_gross": round(sum(p.gross_salary for p in items), 2),
        "total_net": round(sum(p.net_salary for p in items), 2),
        "paid_count": sum(1 for p in items if p.status == "paid"),
        "processed_count": sum(1 for p in items if p.status == "processed"),
    }


@router.get("/admin/list/{month}/{year}", response_model=list[PayrollOut])
async def list_payroll(
    month: int,
    year: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    res = await db.execute(
        select(Payroll, Employee, User)
        .join(Employee, Payroll.employee_id == Employee.id)
        .join(User, Employee.user_id == User.id)
        .where(Payroll.month == month, Payroll.year == year)
        .order_by(User.full_name)
    )
    return [_to_out(p, u.full_name) for p, _e, u in res.all()]
