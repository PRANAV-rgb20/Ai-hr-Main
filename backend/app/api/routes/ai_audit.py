"""Audit log viewer — /api/v1/ai/audit-logs/"""
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.audit import AuditLog
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["Audit Logs"])


@router.get("/audit-logs/")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin")),
):
    """Paginated audit log retrieval with optional filters."""
    base = select(AuditLog).order_by(AuditLog.timestamp.desc())

    if action:
        base = base.where(AuditLog.action == action)
    if start_date:
        try:
            base = base.where(AuditLog.timestamp >= datetime.fromisoformat(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            base = base.where(AuditLog.timestamp <= datetime.fromisoformat(end_date))
        except ValueError:
            pass

    # Count total matching rows
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginated result
    paginated = base.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(paginated)
    logs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),  # ceiling division
        "logs": [
            {
                "id": str(lg.id),
                "user_id": str(lg.user_id) if lg.user_id else None,
                "user_email": lg.user_email,
                "action": lg.action,
                "resource_type": lg.resource_type,
                "resource_id": lg.resource_id,
                "details": lg.details,
                "ip_address": lg.ip_address,
                "timestamp": lg.timestamp.isoformat() if lg.timestamp else None,
            }
            for lg in logs
        ],
    }
