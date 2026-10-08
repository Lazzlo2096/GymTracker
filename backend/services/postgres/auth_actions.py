"""Пароль, учётка OAuth и привязка refresh-сессии к jti."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import User
from dependencies.auth import auth
from schemas.auth import TokenResponse
from services.postgres.auth_refresh_sessions import (
    register_refresh_session,
    revoke_refresh_session,
)
from services.postgres.email_verification_actions import is_oauth_synthetic_email
from services.postgres.promo_actions import setup_new_user_promos
from services.postgres.user_profile_satellites import create_user_profile_satellites
from utils.db_errors import is_unique_violation

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """Хеш пароля для users.password_hash (argon2)."""
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Проверяет пароль против сохранённого хеша."""
    return pwd_context.verify(password, password_hash)


def refresh_jti_from_token(token: str) -> str:
    """jti из refresh JWT. AuthX не отдаёт публичный decode, поэтому берём его метод."""
    refresh_payload = auth._decode_token(token=token, verify=True)
    jti = getattr(refresh_payload, "jti", None)
    if not jti:
        raise HTTPException(status_code=500, detail="Refresh token jti missing")
    return str(jti)


def refresh_jti_from_token_response(token_response: TokenResponse) -> str:
    if not token_response.refresh_token:
        raise HTTPException(status_code=500, detail="Refresh token missing")
    return refresh_jti_from_token(token_response.refresh_token)


def bearer_token_value(header_value: str | None) -> str | None:
    if not header_value:
        return None
    value = header_value.strip()
    if value.lower().startswith("bearer "):
        return value[7:].strip()
    return value or None


async def persist_new_refresh_session(
    session: AsyncSession, user: User, token_response: TokenResponse
) -> None:
    jti = refresh_jti_from_token_response(token_response)
    await register_refresh_session(session, user.id, jti)


async def revoke_presented_refresh(
    session: AsyncSession,
    user_id: int,
    header_value: str | None,
) -> None:
    """Отзывает сессию устройства по заголовку X-Refresh-Token. Битый токен не роняет logout."""
    refresh_raw = bearer_token_value(header_value)
    if not refresh_raw:
        return

    try:
        refresh_payload = auth._decode_token(token=refresh_raw, verify=True)
        jti = getattr(refresh_payload, "jti", None)
        if jti and str(refresh_payload.sub) == str(user_id):
            await revoke_refresh_session(session, user_id, str(jti))
    except Exception:
        logger.warning(
            "logout: refresh session was not revoked user_id=%s",
            user_id,
            exc_info=True,
        )


def _normalize_name_seed(raw: str | None, fallback: str) -> str:
    """Приводит строку к безопасному префиксу для уникального display_name."""
    base = (raw or "").strip() or fallback
    base = re.sub(r"\s+", "_", base)
    base = re.sub(r"[^A-Za-z0-9_.-]+", "", base)

    return base[:40] if base else fallback


async def _allocate_unique_display_name(session: AsyncSession, seed: str) -> str:
    """Подбирает уникальный display_name, не совпадающий с существующими в БД."""
    base = _normalize_name_seed(seed, "user")

    for i in range(100):
        candidate = base if i == 0 else f"{base}_{i}"

        exists = await session.execute(
            select(User.id).where(User.display_name == candidate)
        )
        if exists.scalar_one_or_none() is None:
            return candidate

    return f"{base}_{uuid.uuid4().hex[:8]}"


async def get_or_create_oauth_user(
    session: AsyncSession, identity: dict, *, promo_code: str | None = None
) -> tuple[User, bool]:
    """
    Находит пользователя по email или создаёт нового после OAuth.

    identity — словарь от exchange_code_and_get_identity (provider, email, …).
    """
    provider = identity.get("provider") or "oauth"
    provider_uid = str(identity.get("provider_uid") or "").strip()
    email = (identity.get("email") or "").strip().lower()
    display_name = (identity.get("display_name") or "").strip()

    user: User | None = None
    if email:
        res = await session.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()

    if user is None and provider_uid:
        synthetic = f"{provider}_{provider_uid}@oauth.local"
        res = await session.execute(select(User).where(User.email == synthetic))
        user = res.scalar_one_or_none()

    if user is not None:
        return user, False

    if not email:
        if not provider_uid:
            raise HTTPException(
                status_code=400, detail="OAuth provider identity is incomplete"
            )
        email = f"{provider}_{provider_uid}@oauth.local"

    desired_name = display_name or email.split("@")[0] or f"{provider}_user"
    unique_name = await _allocate_unique_display_name(session, desired_name)

    now = datetime.now(timezone.utc)
    user = User(
        email=email,
        display_name=unique_name,
        password_hash=None,
        email_verified_at=None if is_oauth_synthetic_email(email) else now,
    )
    session.add(user)
    await session.flush()
    await create_user_profile_satellites(session, user.id)

    try:
        await setup_new_user_promos(session, user, promo_code)
        await session.commit()
    except HTTPException:
        await session.rollback()
        raise
    except IntegrityError as exc:
        await session.rollback()
        if is_unique_violation(exc):
            res = await session.execute(select(User).where(User.email == email))
            user = res.scalar_one_or_none()
            if user is not None:
                return user, False
            raise HTTPException(
                status_code=409,
                detail="Не удалось создать OAuth-пользователя: конфликт данных",
            ) from exc
        raise HTTPException(
            status_code=400, detail="Не удалось создать OAuth-пользователя"
        ) from exc

    await session.refresh(user)
    return user, True
