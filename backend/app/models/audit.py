"""Audit log model."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[Optional[str]]    = mapped_column(UUID(as_uuid=False), nullable=True)
    user_email: Mapped[str]           = mapped_column(String(200), nullable=False, default="")
    action: Mapped[str]               = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str]        = mapped_column(String(100), nullable=False, default="")
    resource_id: Mapped[Optional[str]]= mapped_column(String(200), nullable=True)
    details: Mapped[Optional[dict]]   = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    timestamp: Mapped[datetime]       = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
