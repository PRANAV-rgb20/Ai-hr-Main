"""Sentiment check-in model."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SentimentCheckIn(Base):
    __tablename__ = "sentiment_checkins"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    employee_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    mood_text: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Float, nullable=False)
    sentiment_label: Mapped[str] = mapped_column(String(20), nullable=False)
    key_themes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
