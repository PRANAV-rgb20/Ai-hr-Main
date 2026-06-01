"""Department + Employee models."""
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    head_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    employee_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    department_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    designation: Mapped[str] = mapped_column(String(120), default="")
    date_of_joining: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    emergency_contact: Mapped[str] = mapped_column(String(120), default="")
    profile_photo_url: Mapped[str] = mapped_column(String(500), default="")
    manager_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", lazy="joined")
    department = relationship("Department", foreign_keys=[department_id], lazy="joined")
    manager = relationship("Employee", remote_side=[id], lazy="joined")
