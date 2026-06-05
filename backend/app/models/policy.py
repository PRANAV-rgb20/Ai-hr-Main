"""Policy document chunks with embeddings for RAG chatbot."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PolicyDocument(Base):
    __tablename__ = "policy_documents"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str]         = mapped_column(String(200), nullable=False, index=True)
    file_url: Mapped[str]      = mapped_column(String(500), nullable=False, default="")
    chunk_index: Mapped[int]   = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str]    = mapped_column(Text, nullable=False)
    embedding_str: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
