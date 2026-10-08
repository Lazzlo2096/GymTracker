"""Публичные упражнения — каталог сообщества и копирование."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.exercise_in_catalog import ExerciseInCatalogCreateResponse
from schemas.exercise_library import PublicExerciseOut, PublicExerciseOutWithAuthor
from services.postgres.public_exercise_actions import (
    copy_public_exercise_to_catalog,
    get_public_exercise,
    list_my_public_exercises,
    list_public_exercises,
)

router = APIRouter(prefix="/public-exercises", tags=["public_exercises"])


@router.get("/", response_model=list[PublicExerciseOutWithAuthor])
async def list_public(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    muscle_group: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(description="Поиск по названию")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Список опубликованных упражнений всех пользователей."""
    _ = auth_user
    return await list_public_exercises(
        session, muscle_group=muscle_group, q=q, limit=limit, offset=offset
    )


@router.get("/mine", response_model=list[PublicExerciseOut])
async def list_mine(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Мои публикации."""
    return await list_my_public_exercises(session, auth_user)


@router.get("/{item_id}", response_model=PublicExerciseOutWithAuthor)
async def get_public(
    item_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    _ = auth_user
    return await get_public_exercise(session, item_id)


@router.post(
    "/{item_id}/copy-to-catalog", response_model=ExerciseInCatalogCreateResponse
)
async def copy_public_to_catalog(
    item_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Скопировать публичное упражнение в личный каталог (дубликат)."""
    return await copy_public_exercise_to_catalog(session, item_id, auth_user)
