"""Redis cache helper (Upstash TLS)."""
import json
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

_redis: Optional[aioredis.Redis] = None


def get_redis() -> Optional[aioredis.Redis]:
    global _redis
    if not settings.REDIS_URL:
        return None
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    r = get_redis()
    if r is None:
        return None
    try:
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 1800) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except Exception:
        pass
