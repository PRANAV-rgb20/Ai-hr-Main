"""Employee + Department routes."""
import os
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cloudinary_upload import upload_profile_image
from app.core.database import get_db
from app.core.exceptions import api_error
from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.models.employee import Department, Employee
from app.models.user import RoleEnum, User
from app.schemas import (
    DepartmentCreate,
    DepartmentOut,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeOut,
    EmployeeUpdate,
)

router = APIRouter(tags=["employees"])


def _employee_to_out(emp: Employee) -> EmployeeOut:
    return EmployeeOut(
        id=str(emp.id),
        user_id=str(emp.user_id),
        employee_code=emp.employee_code,
        department_id=str(emp.department_id) if emp.department_id else None,
        department_name=emp.department.name if emp.department else None,
        designation=emp.designation,
        date_of_joining=emp.date_of_joining,
        phone=emp.phone,
        address=emp.address,
        emergency_contact=emp.emergency_contact,
        profile_photo_url=emp.profile_photo_url,
        manager_id=str(emp.manager_id) if emp.manager_id else None,
        is_active=emp.is_active,
        email=emp.user.email if emp.user else None,
        full_name=emp.user.full_name if emp.user else None,
        role=emp.user.role if emp.user else None,
    )


# ----- Departments -----
@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Department).order_by(Department.name))
    return res.scalars().all()


@router.post("/departments", response_model=DepartmentOut, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    dept = Department(name=payload.name)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


# ----- Employees -----
@router.get("/employees", response_model=EmployeeListResponse)
async def list_employees(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    department_id: Optional[str] = None,
):
    stmt = select(Employee).join(User, Employee.user_id == User.id)
    count_stmt = select(func.count(Employee.id)).join(User, Employee.user_id == User.id)
    conditions = []
    if search:
        like = f"%{search.lower()}%"
        conditions.append(or_(func.lower(User.full_name).like(like), func.lower(User.email).like(like), func.lower(Employee.employee_code).like(like)))
    if department_id:
        conditions.append(Employee.department_id == department_id)
    if current.role == "senior_manager":
        conditions.append(or_(Employee.manager_id.in_(select(Employee.id).where(Employee.user_id == current.id)), Employee.user_id == current.id))
    elif current.role == "employee":
        conditions.append(Employee.user_id == current.id)
    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(Employee.employee_code).offset((page - 1) * page_size).limit(page_size)
    res = await db.execute(stmt)
    items = [_employee_to_out(e) for e in res.scalars().unique().all()]
    return EmployeeListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/employees/{employee_id}", response_model=EmployeeOut)
async def get_employee(
    employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current.role == "employee" and emp.user_id != current.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return _employee_to_out(emp)


@router.post("/employees", response_model=EmployeeOut, status_code=201)
async def create_employee(
    payload: EmployeeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    if payload.role not in [r.value for r in RoleEnum]:
        raise HTTPException(status_code=400, detail="Invalid role")
    email = payload.email.lower().strip()
    if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")
    if (await db.execute(select(Employee).where(Employee.employee_code == payload.employee_code))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee code already exists")

    user = User(email=email, hashed_password=hash_password(payload.password), full_name=payload.full_name, role=payload.role, is_active=True)
    db.add(user)
    await db.flush()
    emp = Employee(
        user_id=user.id,
        employee_code=payload.employee_code,
        department_id=payload.department_id,
        designation=payload.designation,
        date_of_joining=payload.date_of_joining,
        phone=payload.phone,
        address=payload.address,
        emergency_contact=payload.emergency_contact,
        manager_id=payload.manager_id,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return _employee_to_out(emp)


@router.put("/employees/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("management_admin"))],
):
    res = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(emp, k, v)
    await db.commit()
    await db.refresh(emp)
    return _employee_to_out(emp)


@router.post("/employees/{employee_id}/photo")
async def upload_photo(
    employee_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    res = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = res.scalar_one_or_none()
    if not emp:
        api_error(404, "Employee not found", "employee_not_found")
    if current.role not in ("management_admin",) and emp.user_id != current.id:
        api_error(403, "Forbidden", "forbidden")
    contents = await file.read()
    emp.profile_photo_url = await upload_profile_image(contents, employee_id)
    await db.commit()
    return {"profile_photo_url": emp.profile_photo_url}
