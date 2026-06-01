"""Payroll model."""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PayrollStatus(str, enum.Enum):
    draft = "draft"
    processed = "processed"
    paid = "paid"


class Payroll(Base):
    __tablename__ = "payrolls"
    __table_args__ = (UniqueConstraint("employee_id", "month", "year", name="uq_payroll_emp_period"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    basic_salary: Mapped[float] = mapped_column(Float, default=0.0)
    hra: Mapped[float] = mapped_column(Float, default=0.0)
    transport_allowance: Mapped[float] = mapped_column(Float, default=0.0)
    medical_allowance: Mapped[float] = mapped_column(Float, default=0.0)
    gross_salary: Mapped[float] = mapped_column(Float, default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Float, default=0.0)
    tax_deduction: Mapped[float] = mapped_column(Float, default=0.0)
    other_deductions: Mapped[float] = mapped_column(Float, default=0.0)
    net_salary: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(Enum(PayrollStatus, name="payroll_status", native_enum=False, length=16), default=PayrollStatus.draft)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
