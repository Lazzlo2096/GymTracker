"""Верификация email: токены, отправка писем, подтверждение."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import EmailVerificationToken, User
from project_config import settings
from services.email.smtp_client import send_email_async
from utils.cache import invalidate_me_cache

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "email" / "templates"
_RESEND_COOLDOWN_SECONDS = 60


def is_email_verified(user: User) -> bool:
    return user.email_verified_at is not None


def is_oauth_synthetic_email(email: str) -> bool:
    return email.endswith("@oauth.local")


def _token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _render_template(name: str, **kwargs: str) -> str:
    text = (_TEMPLATES_DIR / name).read_text(encoding="utf-8")
    for key, value in kwargs.items():
        text = text.replace(f"{{{{ {key} }}}}", value)
    return text


def _verify_url(raw_token: str) -> str:
    base = settings.PUBLIC_APP_URL.rstrip("/")
    return f"{base}/api/v1/auth/email/verify?token={raw_token}"


async def _check_resend_cooldown(session: AsyncSession, user_id: int) -> None:
    r = await session.execute(
        select(EmailVerificationToken.created_at)
        .where(EmailVerificationToken.user_id == user_id)
        .order_by(desc(EmailVerificationToken.created_at))
        .limit(1)
    )
    last = r.scalar_one_or_none()
    if last is None:
        return
    now = datetime.now(timezone.utc)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if (now - last).total_seconds() < _RESEND_COOLDOWN_SECONDS:
        raise HTTPException(
            status_code=429,
            detail="Подождите минуту перед повторной отправкой письма",
        )


async def send_verification_email(session: AsyncSession, user: User) -> None:
    """Создаёт токен и отправляет письмо. Не бросает при ошибке SMTP (логирует)."""
    if is_email_verified(user):
        return
    if is_oauth_synthetic_email(user.email):
        return

    await _check_resend_cooldown(session, user.id)

    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFY_TOKEN_TTL_HOURS
    )

    await session.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.consumed_at.is_(None),
        )
    )

    row = EmailVerificationToken(
        user_id=user.id,
        token_hash=_token_hash(raw_token),
        expires_at=expires_at,
    )
    session.add(row)
    await session.commit()

    html = _render_template(
        "verification.html",
        display_name=user.display_name,
        email=user.email,
        verify_url=_verify_url(raw_token),
        ttl_hours=str(settings.EMAIL_VERIFY_TOKEN_TTL_HOURS),
    )

    try:
        await send_email_async(
            to=user.email,
            subject="Подтвердите email — GymTracker",
            html=html,
        )
    except Exception:
        logger.warning(
            "Не удалось отправить письмо верификации user_id=%s", user.id, exc_info=True
        )


async def send_verification_email_required(session: AsyncSession, user: User) -> None:
    """Resend: бросает HTTPException при ошибке или cooldown."""
    if is_email_verified(user):
        raise HTTPException(status_code=400, detail="Email уже подтверждён")
    if is_oauth_synthetic_email(user.email):
        raise HTTPException(
            status_code=400, detail="Для этого аккаунта верификация не требуется"
        )

    await _check_resend_cooldown(session, user.id)

    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFY_TOKEN_TTL_HOURS
    )

    await session.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.consumed_at.is_(None),
        )
    )

    row = EmailVerificationToken(
        user_id=user.id,
        token_hash=_token_hash(raw_token),
        expires_at=expires_at,
    )
    session.add(row)
    await session.commit()

    html = _render_template(
        "verification.html",
        display_name=user.display_name,
        email=user.email,
        verify_url=_verify_url(raw_token),
        ttl_hours=str(settings.EMAIL_VERIFY_TOKEN_TTL_HOURS),
    )

    try:
        await send_email_async(
            to=user.email,
            subject="Подтвердите email — GymTracker",
            html=html,
        )
    except Exception as e:
        logger.error("SMTP resend failed user_id=%s", user.id, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Не удалось отправить письмо. Попробуйте позже.",
        ) from e


async def verify_email_token(session: AsyncSession, raw_token: str) -> User:
    """Подтверждает email по токену из письма."""
    token = raw_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Токен не указан")

    digest = _token_hash(token)
    now = datetime.now(timezone.utc)

    r = await session.execute(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.token_hash == digest,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .limit(1)
    )
    row = r.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=400, detail="Ссылка недействительна или уже использована"
        )

    exp = row.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        raise HTTPException(status_code=400, detail="Срок действия ссылки истёк")

    user = await session.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Пользователь не найден")

    if not is_email_verified(user):
        user.email_verified_at = now
    row.consumed_at = now

    await session.commit()
    await session.refresh(user)
    await invalidate_me_cache(user.id)
    return user


_SUCCESS_ICON_SVG = """<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="200" stroke="#00BA00" stroke-width="28"/>
  <path d="M168 256l56 56 120-120" stroke="#00BA00" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"""

_ERROR_ICON_SVG = """<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="200" stroke="#dc2626" stroke-width="28"/>
  <path d="M184 184l144 144M328 184L184 328" stroke="#dc2626" stroke-width="32" stroke-linecap="round"/>
</svg>"""


def render_verify_result_html(*, success: bool, message: str) -> str:
    if success:
        return _render_template(
            "verify_result.html",
            title="Email подтверждён",
            message=message,
            status="ok",
            icon_svg=_SUCCESS_ICON_SVG,
        )
    return _render_template(
        "verify_result.html",
        title="Не удалось подтвердить",
        message=message,
        status="err",
        icon_svg=_ERROR_ICON_SVG,
    )
