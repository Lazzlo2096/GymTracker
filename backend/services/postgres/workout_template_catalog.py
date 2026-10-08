"""Привязка упражнений шаблона к каталогу пользователя."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres.exercise_in_catalog import ExerciseInCatalog
from db.repositories.postgres.exercise_catalog_repository import find_by_name_for_user


async def find_catalog_by_name_ci_for_user(
    session: AsyncSession,
    name: str,
    user_id: int,
) -> ExerciseInCatalog | None:
    """Поиск упражнения в каталоге без учёта регистра."""
    normalized = name.strip()
    if not normalized:
        return None
    result = await session.execute(
        select(ExerciseInCatalog).where(
            ExerciseInCatalog.user_id == user_id,
            func.lower(ExerciseInCatalog.name) == normalized.lower(),
        )
    )
    return result.scalar_one_or_none()


async def ensure_catalog_exercise_for_user(
    session: AsyncSession,
    user_id: int,
    name: str,
    *,
    muscle_group: str | None = None,
) -> ExerciseInCatalog:
    """
    Найти упражнение в каталоге по имени или создать новое.

    Используется при сиде шаблонов и при импорте демо-данных.
    """
    normalized = name.strip()
    if not normalized:
        raise ValueError("catalog exercise name is required")

    existing = await find_by_name_for_user(session, normalized, user_id)
    if existing is not None:
        return existing

    existing_ci = await find_catalog_by_name_ci_for_user(session, normalized, user_id)
    if existing_ci is not None:
        return existing_ci

    row = ExerciseInCatalog(
        user_id=user_id,
        name=normalized,
        muscle_group=(muscle_group or "").strip() or None,
        icon="barbell",
    )
    session.add(row)
    await session.flush()
    return row
