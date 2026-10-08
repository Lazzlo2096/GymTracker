"""Патч профиля пользователя и загрузка аватара."""

from __future__ import annotations

import uuid
from datetime import time
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from project_config import settings
from db.models.postgres import User as PgUser
from db.models.postgres.user_gym import UserGym
from schemas.auth import UserMe, UserGymBriefOut, UserMeUpdate
from utils.db_errors import rollback_and_raise_integrity
from utils.experience_ru import experience_label_from_created_at
from services.postgres.premium_actions import is_premium_active
from services.postgres.user_profile_satellites import (
    CLIENT_SETTINGS_FIELDS,
    FITNESS_DATA_FIELDS,
    REMINDS_FIELDS,
    ensure_user_profile_satellites,
)
from utils.cache import invalidate_me_cache


async def _validate_preferred_gym(
    session: AsyncSession, user_id: int, gym_id: int | None
) -> None:
    if gym_id is None:
        return

    row = await session.get(UserGym, gym_id)
    if not row or row.user_id != user_id or row.is_archived:
        raise HTTPException(status_code=400, detail="Указанный зал не найден")


def _parse_hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(hour=int(h), minute=int(m))


def _format_hhmm(value: time | None) -> str | None:
    if value is None:
        return None
    return f"{value.hour:02d}:{value.minute:02d}"


async def postgres_patch_user_profile(
    session: AsyncSession,
    user: PgUser,
    data: UserMeUpdate,
) -> PgUser:
    patch = data.model_dump(exclude_unset=True)
    if not patch:
        return user

    await ensure_user_profile_satellites(session, user)
    fitness_data = user.fitness_data
    client_settings = user.client_settings
    reminds = user.reminds
    assert (
        fitness_data is not None and client_settings is not None and reminds is not None
    )

    if "workout_reminder_time" in patch:
        raw = patch.pop("workout_reminder_time")
        patch["workout_reminder_time"] = _parse_hhmm(raw) if raw else None

    if "preferred_user_gym_id" in patch:
        await _validate_preferred_gym(session, user.id, patch["preferred_user_gym_id"])

    if "display_name" in patch and patch["display_name"] != user.display_name:
        exists = await session.execute(
            select(PgUser.id).where(
                PgUser.display_name == patch["display_name"],
                PgUser.id != user.id,
            )
        )
        if exists.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Имя пользователя уже занято")

    fitness_patch = {k: patch.pop(k) for k in list(patch) if k in FITNESS_DATA_FIELDS}
    client_patch = {k: patch.pop(k) for k in list(patch) if k in CLIENT_SETTINGS_FIELDS}
    reminds_patch = {k: patch.pop(k) for k in list(patch) if k in REMINDS_FIELDS}

    for k, v in patch.items():
        if hasattr(user, k):
            setattr(user, k, v)

    for k, v in fitness_patch.items():
        setattr(fitness_data, k, v)

    for k, v in client_patch.items():
        setattr(client_settings, k, v)

    for k, v in reminds_patch.items():
        setattr(reminds, k, v)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Имя пользователя уже занято",
            other_detail="Не удалось сохранить профиль",
        )

    await session.refresh(user)
    await invalidate_me_cache(user.id)
    return user


async def postgres_upload_user_avatar(
    session: AsyncSession,
    user: PgUser,
    file: UploadFile,
) -> str:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")

    ext = Path(file.filename or "image.bin").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".jpg"

    user_dir = Path(settings.MEDIA_ROOT) / "avatars" / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"avatar_{uuid.uuid4().hex}{ext}"
    target = user_dir / file_name

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Пустой файл")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 10MB)")

    target.write_bytes(content)
    for old in user_dir.glob("avatar_*"):
        if old.is_file() and old.name != file_name:
            old.unlink(missing_ok=True)

    rel_url = f"{settings.MEDIA_URL_PREFIX.rstrip('/')}/avatars/{user.id}/{file_name}"
    user.avatar_url = rel_url

    await session.commit()
    await session.refresh(user)
    await invalidate_me_cache(user.id)

    return rel_url


async def build_user_me(session: AsyncSession, user: PgUser) -> UserMe:
    await ensure_user_profile_satellites(session, user)
    fitness_data = user.fitness_data
    client_settings = user.client_settings
    reminds = user.reminds
    assert (
        fitness_data is not None and client_settings is not None and reminds is not None
    )

    pref = None
    g = fitness_data.preferred_user_gym
    if g is not None:
        pref = UserGymBriefOut.model_validate(g)

    return UserMe(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        created_at=user.created_at,
        experience_label=experience_label_from_created_at(user.created_at),
        avatar_url=user.avatar_url,
        height_cm=fitness_data.height_cm,
        birth_date=user.birth_date,
        training_goal=fitness_data.training_goal,
        target_weight_kg=fitness_data.target_weight_kg,
        measurement_units=client_settings.measurement_units or "metric",
        settings_notifications=bool(client_settings.settings_notifications),
        settings_dark_theme=bool(client_settings.settings_dark_theme),
        settings_workout_reminders=bool(reminds.settings_workout_reminders),
        workout_reminder_time=_format_hhmm(reminds.workout_reminder_time),
        workout_reminder_weekdays=reminds.workout_reminder_weekdays or "1,2,3,4,5,6,7",
        workout_reminder_timezone=reminds.workout_reminder_timezone or "UTC",
        preferred_user_gym_id=fitness_data.preferred_user_gym_id,
        preferred_gym=pref,
        is_premium=is_premium_active(user),
        premium_until=user.premium_until,
        premium_lifetime=bool(user.premium_lifetime),
        email_verified_at=user.email_verified_at,
        is_email_verified=user.email_verified_at is not None,
    )
