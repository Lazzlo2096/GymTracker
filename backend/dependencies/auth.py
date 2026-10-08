"""Зависимости аутентификации (AuthX, JWT cookies)."""

from typing import Annotated

from fastapi import Depends, HTTPException
from datetime import timedelta

from authx import AuthX, AuthXConfig, TokenPayload
from sqlalchemy import select

from db.models.postgres import User
from project_config import settings
from dependencies.db_session import db_session

auth = AuthX(
    config=AuthXConfig(
        JWT_SECRET_KEY=settings.AUTH_SECRET,
        # cookies — браузер; headers — React Native (Bearer из SecureStore)
        JWT_TOKEN_LOCATION=["cookies", "headers"],
        JWT_COOKIE_SECURE=settings.COOKIE_SECURE,
        JWT_COOKIE_SAMESITE=settings.COOKIE_SAMESITE,
        JWT_COOKIE_DOMAIN=settings.COOKIE_DOMAIN or None,
        # Мобильный клиент ходит с Bearer, заголовок X-CSRF-TOKEN не требуется.
        JWT_COOKIE_CSRF_PROTECT=False,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=settings.ACCESS_TTL_MINUTES),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=settings.REFRESH_TTL_DAYS),
    )
)


async def get_current_user(
    session: db_session,
    payload: Annotated[TokenPayload, Depends(auth.access_token_required)],
) -> User:
    try:
        user_id = int(payload.sub)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token subject") from e

    result = await session.execute(select(User).where(User.id == user_id))

    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


current_user = Annotated[User, Depends(get_current_user)]
