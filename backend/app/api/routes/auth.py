"""Auth routes — register/login/refresh/me."""
from datetime import datetime, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import RoleEnum, User
from app.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserOut
from app.core.audit import log_action
from app.core.redis_cache import cache_set

router = APIRouter(prefix="/auth", tags=["auth"])


async def _cache_user(user: User) -> None:
    await cache_set(
        f"user:{user.id}",
        {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
        },
        ttl_seconds=1800,
    )


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    email = payload.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    if payload.role not in [r.value for r in RoleEnum]:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)], request: Request = None):
    from fastapi import Request as _Req
    email = payload.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account inactive")
    await log_action(db, user, "login", "auth", str(user.id), request=request)
    await _cache_user(user)
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role),
        refresh_token=create_refresh_token(str(user.id)),
        role=user.role,
        full_name=user.full_name,
        user_id=str(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = decoded["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    await _cache_user(user)
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role),
        refresh_token=create_refresh_token(str(user.id)),
        role=user.role,
        full_name=user.full_name,
        user_id=str(user.id),
    )


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[User, Depends(get_current_user)]):
    return user
