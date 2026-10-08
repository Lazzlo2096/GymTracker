"""Premium-статус пользователя."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import User


def is_premium_active(user: User) -> bool:
    if bool(user.premium_lifetime):
        return True
    until = user.premium_until
    if until is None:
        return False
    now = datetime.now(timezone.utc)
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return until > now


async def grant_premium_days(
    session: AsyncSession, user_id: int, *, days: int = 7
) -> None:
    user = await session.get(User, user_id)
    if not user:
        return
    if bool(user.premium_lifetime):
        return
    now = datetime.now(timezone.utc)
    base = user.premium_until
    if base is not None:
        if base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
        if base > now:
            start = base
        else:
            start = now
    else:
        start = now
    user.premium_until = start + timedelta(days=days)


async def grant_premium_lifetime(session: AsyncSession, user_id: int) -> None:
    user = await session.get(User, user_id)
    if not user:
        return
    user.premium_lifetime = True
