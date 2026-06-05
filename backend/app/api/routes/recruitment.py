"""Recruitment routes — jobs, candidates, public apply endpoint."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cloudinary_upload import upload_resume_pdf
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.exceptions import api_error
from app.models.employee import Department
from app.models.notification import Notification
from app.models.recruitment import Candidate, CandidateStatus, JobPosting, JobStatus
from app.models.user import RoleEnum, User
from app.schemas import (
    CandidateApply,
    CandidateOut,
    CandidateStatusUpdate,
    JobCreate,
    JobOut,
    JobUpdate,
)

router = APIRouter(tags=["recruitment"])


def _job_to_out(j: JobPosting, dept_name: Optional[str] = None, count: int = 0) -> JobOut:
    return JobOut(
        id=str(j.id),
        title=j.title,
        department_id=str(j.department_id) if j.department_id else None,
        department_name=dept_name,
        description=j.description,
        requirements=j.requirements,
        status=j.status,
        created_at=j.created_at,
        candidate_count=count,
    )


def _candidate_to_out(c: Candidate, job_title: Optional[str] = None) -> CandidateOut:
    return CandidateOut(
        id=str(c.id),
        job_id=str(c.job_id),
        job_title=job_title,
        name=c.name,
        email=c.email,
        phone=c.phone,
        resume_url=c.resume_url,
        status=c.status,
        applied_at=c.applied_at,
    )


# ----- Jobs -----
@router.get("/jobs", response_model=list[JobOut])
async def list_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    status_filter: Optional[str] = None,
):
    stmt = (
        select(JobPosting, Department, func.count(Candidate.id))
        .join(Department, JobPosting.department_id == Department.id, isouter=True)
        .join(Candidate, Candidate.job_id == JobPosting.id, isouter=True)
        .group_by(JobPosting.id, Department.id)
        .order_by(JobPosting.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(JobPosting.status == status_filter)
    rows = await db.execute(stmt)
    return [_job_to_out(j, d.name if d else None, c or 0) for j, d, c in rows.all()]


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(
    job_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    j = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one_or_none()
    if not j:
        api_error(404, "Job not found", "job_not_found")
    dept = None
    if j.department_id:
        dept = (await db.execute(select(Department).where(Department.id == j.department_id))).scalar_one_or_none()
    count = (await db.execute(select(func.count(Candidate.id)).where(Candidate.job_id == j.id))).scalar() or 0
    return _job_to_out(j, dept.name if dept else None, count)


@router.post("/jobs", response_model=JobOut, status_code=201)
async def create_job(
    payload: JobCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("hr_recruiter", "management_admin"))],
):
    j = JobPosting(
        title=payload.title,
        department_id=payload.department_id,
        description=payload.description,
        requirements=payload.requirements,
        status=JobStatus.open,
        created_by=user.id,
    )
    db.add(j)
    await db.commit()
    await db.refresh(j)
    return _job_to_out(j)


@router.put("/jobs/{job_id}", response_model=JobOut)
async def update_job(
    job_id: str,
    payload: JobUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("hr_recruiter", "management_admin"))],
):
    j = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one_or_none()
    if not j:
        api_error(404, "Job not found", "job_not_found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(j, k, v)
    await db.commit()
    await db.refresh(j)
    return _job_to_out(j)


# ----- Candidates -----
@router.get("/jobs/{job_id}/candidates", response_model=list[CandidateOut])
async def list_candidates(
    job_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("hr_recruiter", "management_admin"))],
):
    res = await db.execute(select(Candidate).where(Candidate.job_id == job_id).order_by(Candidate.applied_at.desc()))
    return [_candidate_to_out(c) for c in res.scalars().all()]


@router.get("/candidates", response_model=list[CandidateOut])
async def all_candidates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("hr_recruiter", "management_admin"))],
):
    rows = await db.execute(
        select(Candidate, JobPosting).join(JobPosting, Candidate.job_id == JobPosting.id).order_by(Candidate.applied_at.desc())
    )
    return [_candidate_to_out(c, j.title) for c, j in rows.all()]


@router.post("/jobs/{job_id}/apply", response_model=CandidateOut, status_code=201)
async def apply_job(
    request: Request,
    job_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Public endpoint — no auth. Accepts JSON or multipart/form-data (with optional resume PDF)."""
    content_type = request.headers.get("content-type", "")
    resume_url = ""
    resume_file: UploadFile | None = None

    if "application/json" in content_type:
        payload = CandidateApply.model_validate(await request.json())
        name, email, phone = payload.name, payload.email, payload.phone
        resume_url = payload.resume_url or ""
    else:
        form = await request.form()
        name = str(form.get("name", "")).strip()
        email = str(form.get("email", "")).strip()
        phone = str(form.get("phone", "")).strip()
        resume_url = str(form.get("resume_url", "")).strip()
        maybe_file = form.get("resume")
        if maybe_file and hasattr(maybe_file, "read"):
            resume_file = maybe_file  # type: ignore[assignment]

    if not name or not email:
        api_error(422, "Name and email are required", "validation_error")

    j = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one_or_none()
    if not j:
        api_error(404, "Job not found", "job_not_found")
    if j.status != JobStatus.open:
        api_error(409, "Job is closed for applications", "job_closed")

    if resume_file:
        try:
            resume_url = await upload_resume_pdf(resume_file, job_id, email)
        except Exception as upload_err:
            import logging
            logging.getLogger("hrms").warning(f"Resume upload to Cloudinary failed: {upload_err}. Saving candidate without resume.")
            resume_url = ""  # Accept application even if upload fails

    c = Candidate(
        job_id=j.id,
        name=name,
        email=email.lower(),
        phone=phone,
        resume_url=resume_url,
        status=CandidateStatus.applied,
    )
    db.add(c)
    recruiters = (await db.execute(select(User).where(User.role == RoleEnum.hr_recruiter.value))).scalars().all()
    for r in recruiters:
        db.add(Notification(
            user_id=r.id,
            type="candidate",
            title="New candidate applied",
            message=f"{name} applied for {j.title}",
        ))
    await db.commit()
    await db.refresh(c)
    return _candidate_to_out(c, j.title)


@router.put("/candidates/{candidate_id}/status", response_model=CandidateOut)
async def update_candidate_status(
    candidate_id: str,
    payload: CandidateStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("hr_recruiter", "management_admin"))],
):
    if payload.status not in [s.value for s in CandidateStatus]:
        api_error(400, "Invalid status", "invalid_status")
    c = (await db.execute(select(Candidate).where(Candidate.id == candidate_id))).scalar_one_or_none()
    if not c:
        api_error(404, "Candidate not found", "candidate_not_found")
    c.status = payload.status
    await db.commit()
    await db.refresh(c)
    j = (await db.execute(select(JobPosting).where(JobPosting.id == c.job_id))).scalar_one_or_none()
    return _candidate_to_out(c, j.title if j else None)
