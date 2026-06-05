"""Cache helper with fast local fallback for development."""
import asyncio
import json
import time
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

_redis: Optional[aioredis.Redis] = None
_memory_cache: dict[str, tuple[float, Any]] = {}
_REDIS_TIMEOUT_SECONDS = 0.35
_REDIS_LOCAL_TTL_SECONDS = 60


def get_redis() -> Optional[aioredis.Redis]:
    global _redis
    if not settings.REDIS_URL:
        return None
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=_REDIS_TIMEOUT_SECONDS,
            socket_timeout=_REDIS_TIMEOUT_SECONDS,
        )
    return _redis


def _memory_get(key: str) -> Optional[Any]:
    item = _memory_cache.get(key)
    if not item:
        return None
    expires_at, value = item
    if expires_at <= time.monotonic():
        _memory_cache.pop(key, None)
        return None
    return value


def _memory_set(key: str, value: Any, ttl_seconds: int) -> None:
    _memory_cache[key] = (time.monotonic() + ttl_seconds, value)


async def cache_get(key: str) -> Optional[Any]:
    cached = _memory_get(key)
    if cached is not None:
        return cached

    r = get_redis()
    if r is None:
        return None
    try:
        val = await asyncio.wait_for(r.get(key), timeout=_REDIS_TIMEOUT_SECONDS)
        if not val:
            return None
        data = json.loads(val)
        _memory_set(key, data, _REDIS_LOCAL_TTL_SECONDS)
        return data
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 1800) -> None:
    _memory_set(key, value, ttl_seconds)

    r = get_redis()
    if r is None:
        return
    try:
        await asyncio.wait_for(
            r.setex(key, ttl_seconds, json.dumps(value, default=str)),
            timeout=_REDIS_TIMEOUT_SECONDS,
        )
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    _memory_cache.pop(key, None)

    r = get_redis()
    if r is None:
        return
    try:
        await asyncio.wait_for(r.delete(key), timeout=_REDIS_TIMEOUT_SECONDS)
    except Exception:
        pass
