"""Recruitment models — JobPosting + Candidate."""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class JobStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class CandidateStatus(str, enum.Enum):
    applied = "applied"
    screened = "screened"
    interview = "interview"
    offered = "offered"
    rejected = "rejected"


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    requirements: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(Enum(JobStatus, name="job_status", native_enum=False, length=16), default=JobStatus.open, index=True)
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), default="")
    resume_url: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(Enum(CandidateStatus, name="candidate_status", native_enum=False, length=16), default=CandidateStatus.applied, index=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
