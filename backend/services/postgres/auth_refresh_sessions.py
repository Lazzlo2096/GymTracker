"""Мультиустройственные refresh-сессии (JWT jti)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres.user_refresh_session import UserRefreshSession

MAX_REFRESH_SESSIONS_PER_USER = 20


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def register_refresh_session(
    session: AsyncSession,
    user_id: int,
    jti: str,
) -> None:
    """Новая сессия при login/register/OAuth (не отзывает другие устройства)."""
    if not jti:
        raise HTTPException(status_code=500, detail="Refresh token jti missing")

    count = await session.scalar(
        select(func.count())
        .select_from(UserRefreshSession)
        .where(UserRefreshSession.user_id == user_id)
    )
    count = int(count or 0)
    if count >= MAX_REFRESH_SESSIONS_PER_USER:
        oldest = await session.execute(
            select(UserRefreshSession)
            .where(UserRefreshSession.user_id == user_id)
            .order_by(
                UserRefreshSession.last_used_at.asc(),
                UserRefreshSession.created_at.asc(),
            )
            .limit(count - MAX_REFRESH_SESSIONS_PER_USER + 1)
        )
        for row in oldest.scalars():
            await session.delete(row)

    now = _utcnow()
    session.add(
        UserRefreshSession(
            user_id=user_id,
            jti=jti,
            created_at=now,
            last_used_at=now,
        )
    )


async def get_refresh_session(
    session: AsyncSession,
    user_id: int,
    jti: str,
) -> UserRefreshSession | None:
    result = await session.execute(
        select(UserRefreshSession).where(
            UserRefreshSession.user_id == user_id,
            UserRefreshSession.jti == jti,
        )
    )
    return result.scalar_one_or_none()


async def assert_refresh_session(
    session: AsyncSession,
    user_id: int,
    jti: str,
) -> UserRefreshSession:
    row = await get_refresh_session(session, user_id, jti)
    if row:
        return row

    raise HTTPException(status_code=401, detail="Invalid refresh token")


async def rotate_refresh_session(
    session: AsyncSession,
    user_id: int,
    old_jti: str,
    new_jti: str,
) -> None:
    row = await assert_refresh_session(session, user_id, old_jti)
    row.jti = new_jti
    row.last_used_at = _utcnow()


async def revoke_refresh_session(
    session: AsyncSession,
    user_id: int,
    jti: str,
) -> None:
    await session.execute(
        delete(UserRefreshSession).where(
            UserRefreshSession.user_id == user_id,
            UserRefreshSession.jti == jti,
        )
    )
