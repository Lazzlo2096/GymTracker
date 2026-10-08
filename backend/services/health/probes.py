"""Проверка зависимостей API (PostgreSQL, Redis) для health check."""

from __future__ import annotations

import logging

from sqlalchemy import text
from db_config import SessionLocal
from services.redis.rate_limiter import get_redis

logger = logging.getLogger(__name__)


async def probe_postgres() -> str:
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        logger.exception("Health: PostgreSQL недоступен")
        return "error"


async def probe_redis() -> str:
    try:
        redis = get_redis()
        pong = await redis.ping()
        if pong:
            return "ok"
        return "error"
    except Exception:
        logger.exception("Health: Redis недоступен")
        return "error"
