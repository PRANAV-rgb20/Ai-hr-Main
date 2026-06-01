"""Performance Review + Goal routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.employee import Employee
from app.models.performance import Goal, GoalStatus, PerformanceReview, ReviewStatus
from app.models.user import User
from app.schemas import GoalCreate, GoalOut, GoalUpdate, ReviewCreate, ReviewOut

router = APIRouter(prefix="/performance", tags=["performance"])


def _review_to_out(r: PerformanceReview, name: str | None = None) -> ReviewOut:
    return ReviewOut(
        id=str(r.id),
        employee_id=str(r.employee_id),
        employee_name=name,
        period=r.period,
        year=r.year,
        goals_score=r.goals_score,
        skills_score=r.skills_score,
        attitude_score=r.attitude_score,
        overall_score=r.overall_score,
        comments=r.comments,
        status=r.status,
        created_at=r.created_at,
    )


@router.post("/review", response_model=ReviewOut, status_code=201)
async def create_review(
    payload: ReviewCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("management_admin", "senior_manager"))],
):
    emp = (await db.execute(select(Employee).where(Employee.id == payload.employee_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    overall = round((payload.goals_score + payload.skills_score + payload.attitude_score) / 3, 2)
    r = PerformanceReview(
        employee_id=emp.id,
        reviewer_id=user.id,
        period=payload.period,
        year=payload.year,
        goals_score=payload.goals_score,
        skills_score=payload.skills_score,
        attitude_score=payload.attitude_score,
        overall_score=overall,
        comments=payload.comments,
        status=ReviewStatus.submitted,
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _review_to_out(r, emp.user.full_name if emp.user else None)


@router.get("/my", response_model=list[ReviewOut])
async def my_reviews(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = (await db.execute(select(Employee).where(Employee.user_id == user.id))).scalar_one_or_none()
    if not emp:
        return []
    res = await db.execute(
        select(PerformanceReview).where(PerformanceReview.employee_id == emp.id).order_by(PerformanceReview.created_at.desc())
    )
    return [_review_to_out(r, user.full_name) for r in res.scalars().all()]


@router.get("/team", response_model=list[ReviewOut])
async def team_reviews(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("senior_manager", "management_admin"))],
):
    if user.role == "senior_manager":
        mgr = (await db.execute(select(Employee).where(Employee.user_id == user.id))).scalar_one_or_none()
        if not mgr:
            return []
        team_ids = [e.id for e in (await db.execute(select(Employee).where(Employee.manager_id == mgr.id))).scalars().unique().all()]
    else:
        team_ids = [e.id for e in (await db.execute(select(Employee))).scalars().unique().all()]
    if not team_ids:
        return []
    rows = await db.execute(
        select(PerformanceReview, Employee, User)
        .join(Employee, PerformanceReview.employee_id == Employee.id)
        .join(User, Employee.user_id == User.id)
        .where(PerformanceReview.employee_id.in_(team_ids))
        .order_by(PerformanceReview.created_at.desc())
    )
    return [_review_to_out(r, u.full_name) for r, _e, u in rows.all()]


# ----- Goals -----
def _goal_to_out(g: Goal) -> GoalOut:
    return GoalOut(
        id=str(g.id),
        employee_id=str(g.employee_id),
        title=g.title,
        description=g.description,
        target_date=g.target_date,
        status=g.status,
        progress_percent=g.progress_percent,
    )


@router.post("/goals", response_model=GoalOut, status_code=201)
async def create_goal(
    payload: GoalCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    # Employee can create own goals; manager/admin can create for others
    if user.role == "employee":
        emp = (await db.execute(select(Employee).where(Employee.user_id == user.id))).scalar_one_or_none()
        if not emp or str(emp.id) != payload.employee_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    g = Goal(
        employee_id=payload.employee_id,
        title=payload.title,
        description=payload.description,
        target_date=payload.target_date,
        status=GoalStatus.pending,
        progress_percent=0,
    )
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return _goal_to_out(g)


@router.put("/goals/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    g = (await db.execute(select(Goal).where(Goal.id == goal_id))).scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    if user.role == "employee":
        emp = (await db.execute(select(Employee).where(Employee.user_id == user.id))).scalar_one_or_none()
        if not emp or emp.id != g.employee_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    if g.progress_percent >= 100:
        g.status = GoalStatus.completed
    elif g.progress_percent > 0 and g.status == GoalStatus.pending:
        g.status = GoalStatus.in_progress
    await db.commit()
    await db.refresh(g)
    return _goal_to_out(g)


@router.get("/goals/{employee_id}", response_model=list[GoalOut])
async def list_goals(
    employee_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if user.role == "employee" and emp.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    res = await db.execute(select(Goal).where(Goal.employee_id == employee_id).order_by(Goal.created_at.desc()))
    return [_goal_to_out(g) for g in res.scalars().all()]


@router.get("/my-goals", response_model=list[GoalOut])
async def my_goals(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    emp = (await db.execute(select(Employee).where(Employee.user_id == user.id))).scalar_one_or_none()
    if not emp:
        return []
    res = await db.execute(select(Goal).where(Goal.employee_id == emp.id).order_by(Goal.created_at.desc()))
    return [_goal_to_out(g) for g in res.scalars().all()]
