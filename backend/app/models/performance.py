"""Performance Review + Goal models."""
import enum
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReviewPeriod(str, enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"
    Annual = "Annual"


class ReviewStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"


class GoalStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    period: Mapped[str] = mapped_column(Enum(ReviewPeriod, name="review_period", native_enum=False, length=16), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    goals_score: Mapped[float] = mapped_column(Float, default=0.0)
    skills_score: Mapped[float] = mapped_column(Float, default=0.0)
    attitude_score: Mapped[float] = mapped_column(Float, default=0.0)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    comments: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(Enum(ReviewStatus, name="review_status", native_enum=False, length=16), default=ReviewStatus.submitted)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(Enum(GoalStatus, name="goal_status", native_enum=False, length=16), default=GoalStatus.pending)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
