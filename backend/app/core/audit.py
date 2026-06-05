"""Audit logging helper — fire-and-forget with independent session, never breaks callers."""
import asyncio
import logging
from typing import Optional

from app.models.audit import AuditLog
from app.models.user import User

logger = logging.getLogger("hrms.audit")


async def _write_log(
    user_id: Optional[str],
    user_email: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str],
    details: Optional[dict],
    ip_address: Optional[str],
) -> None:
    """Write audit log using a completely independent DB session."""
    try:
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            log = AuditLog(
                user_id=user_id,
                user_email=user_email,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                ip_address=ip_address,
            )
            session.add(log)
            await session.commit()
    except Exception as exc:
        logger.warning(f"Audit log write failed (action={action}): {exc}")


async def log_action(
    db,  # kept for backward compatibility but NOT used
    user: User,
    action: str,
    resource_type: str = "",
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    request=None,
) -> None:
    """
    Schedule an audit log write as a background task.
    Uses its own independent session — completely isolated from the caller's transaction.
    Never raises, never blocks the caller.
    """
    try:
        ip: Optional[str] = None
        if request is not None and hasattr(request, "client") and request.client:
            ip = request.client.host

        # Fire-and-forget — don't await, don't block the caller
        asyncio.ensure_future(
            _write_log(
                user_id=str(user.id) if user.id else None,
                user_email=user.email or "",
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                ip_address=ip,
            )
        )
    except Exception as exc:
        logger.warning(f"Audit log scheduling failed (action={action}): {exc}")
