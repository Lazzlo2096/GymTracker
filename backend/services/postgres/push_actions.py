"""Отправка push через Expo Push API."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import NotificationLog, User, UserPushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

NOTIF_REFERRAL_INVITED = "referral_invited"
NOTIF_REFERRAL_MILESTONE = "referral_milestone"
NOTIF_WORKOUT_STREAK = "workout_streak"
NOTIF_WORKOUT_HABIT = "workout_habit"


async def upsert_push_token(
    session: AsyncSession,
    user: User,
    *,
    expo_push_token: str,
    platform: str,
) -> None:
    token = expo_push_token.strip()
    if not token.startswith("ExponentPushToken"):
        return

    existing = await session.scalar(
        select(UserPushToken).where(UserPushToken.expo_push_token == token)
    )
    if existing:
        existing.user_id = user.id
        existing.platform = platform
    else:
        session.add(
            UserPushToken(
                user_id=user.id,
                expo_push_token=token,
                platform=platform,
            )
        )
    await session.flush()


async def remove_push_token(
    session: AsyncSession, user: User, expo_push_token: str
) -> None:
    await session.execute(
        delete(UserPushToken).where(
            UserPushToken.user_id == user.id,
            UserPushToken.expo_push_token == expo_push_token.strip(),
        )
    )


async def _user_tokens(session: AsyncSession, user_id: int) -> list[str]:
    r = await session.scalars(
        select(UserPushToken.expo_push_token).where(UserPushToken.user_id == user_id)
    )
    return list(r.all())


def _user_allows_push(user: User, *, workout_related: bool = False) -> bool:
    client = user.client_settings
    reminds = user.reminds
    if client is None or not client.settings_notifications:
        return False
    if workout_related and (reminds is None or not reminds.settings_workout_reminders):
        return False
    return True


async def _log_sent(
    session: AsyncSession, user_id: int, kind: str, dedup_key: str
) -> bool:
    """Возвращает False, если такое уведомление уже отправляли."""
    exists = await session.scalar(
        select(NotificationLog.id).where(
            NotificationLog.user_id == user_id,
            NotificationLog.kind == kind,
            NotificationLog.dedup_key == dedup_key,
        )
    )
    if exists is not None:
        return False
    session.add(NotificationLog(user_id=user_id, kind=kind, dedup_key=dedup_key))
    await session.flush()
    return True


async def send_push_to_user(
    session: AsyncSession,
    user: User,
    *,
    title: str,
    body: str,
    kind: str,
    dedup_key: str,
    data: dict[str, Any] | None = None,
    workout_related: bool = False,
) -> bool:
    if not _user_allows_push(user, workout_related=workout_related):
        return False

    if not await _log_sent(session, user.id, kind, dedup_key):
        return False

    tokens = await _user_tokens(session, user.id)
    if not tokens:
        return False

    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "sound": "default",
            "data": {"kind": kind, **(data or {})},
        }
        for t in tokens
    ]

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(EXPO_PUSH_URL, json=messages)
            resp.raise_for_status()
            payload = resp.json()
            if isinstance(payload, dict) and payload.get("data"):
                for item in payload["data"]:
                    if item.get("status") == "error":
                        detail = item.get("details", {})
                        if detail.get("error") == "DeviceNotRegistered":
                            bad = item.get("message", "")
                            for t in tokens:
                                if t in bad:
                                    await session.execute(
                                        delete(UserPushToken).where(
                                            UserPushToken.expo_push_token == t
                                        )
                                    )
    except Exception:
        logger.exception("Expo push failed for user %s kind=%s", user.id, kind)
        return False

    return True


async def notify_referral_invited(
    session: AsyncSession,
    owner: User,
    *,
    invitee_name: str,
    dedup_key: str,
) -> None:
    await send_push_to_user(
        session,
        owner,
        title="Реферальная программа",
        body=f"{invitee_name} зарегистрировался по вашей ссылке. Ждём 100 т тоннажа!",
        kind=NOTIF_REFERRAL_INVITED,
        dedup_key=dedup_key,
    )


async def notify_referral_milestone(
    session: AsyncSession,
    owner: User,
    *,
    invitee_name: str,
    dedup_key: str,
) -> None:
    await send_push_to_user(
        session,
        owner,
        title="Реферальная награда",
        body=f"{invitee_name} выполнил условие (100 т). Premium навсегда активирован!",
        kind=NOTIF_REFERRAL_MILESTONE,
        dedup_key=dedup_key,
    )
