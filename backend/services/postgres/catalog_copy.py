"""Копирование полей упражнения в личный каталог пользователя (TGL-33)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import ExerciseInCatalog
from db.repositories.postgres.exercise_catalog_repository import find_by_name_for_user
from utils.cache import invalidate_catalog_cache
from utils.db_errors import rollback_and_raise_integrity


async def _resolve_unique_catalog_name(
    session: AsyncSession, user_id: int, base_name: str
) -> str:
    if not await find_by_name_for_user(session, base_name, user_id):
        return base_name
    candidate = f"{base_name} (копия)"
    if not await find_by_name_for_user(session, candidate, user_id):
        return candidate
    for i in range(2, 100):
        candidate = f"{base_name} (копия {i})"
        if not await find_by_name_for_user(session, candidate, user_id):
            return candidate
    raise HTTPException(
        status_code=400,
        detail="Слишком много копий с таким названием в каталоге",
    )


async def copy_fields_to_user_catalog(
    session: AsyncSession,
    user_id: int,
    *,
    name: str,
    notes: str | None = None,
    muscle_group: str | None = None,
    exercise_type: str | None = None,
    machine_location: str | None = None,
    machine_settings: dict | None = None,
    icon: str | None = None,
    image: str | None = None,
    source_system_exercise_id: int | None = None,
    source_public_exercise_id: int | None = None,
) -> ExerciseInCatalog:
    unique_name = await _resolve_unique_catalog_name(session, user_id, name)
    row = ExerciseInCatalog(
        user_id=user_id,
        name=unique_name,
        notes=notes,
        muscle_group=muscle_group,
        exercise_type=exercise_type,
        machine_location=machine_location,
        machine_settings=machine_settings,
        icon=icon or "barbell",
        image=image,
        source_system_exercise_id=source_system_exercise_id,
        source_public_exercise_id=source_public_exercise_id,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Exercise with this name already exists",
            other_detail="Could not save exercise",
        )
    await session.refresh(row)
    await invalidate_catalog_cache(user_id)
    return row


def catalog_row_to_create_response(row: ExerciseInCatalog) -> dict[str, Any]:
    return {
        "message": "Exercise copied to catalog",
        "id": row.id,
        "user_id": row.user_id,
        "name": row.name,
        "notes": row.notes,
        "muscle_group": row.muscle_group,
        "exercise_type": row.exercise_type,
        "machine_location": row.machine_location,
        "machine_settings": row.machine_settings,
        "icon": row.icon,
        "image": row.image,
        "created_at": row.created_at,
    }
