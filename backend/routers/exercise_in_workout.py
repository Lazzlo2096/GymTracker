"""Exercise-in-workout CRUD endpoints."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, status

from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.exercise_in_workout import (
    ExerciseInWorkoutCreate,
    ExerciseInWorkoutCreateResponse,
    ExerciseInWorkoutDeleteResponse,
    ExerciseInWorkoutOut,
    ExerciseInWorkoutPatch,
    ExerciseInWorkoutPatchResponse,
    ExerciseInWorkoutReplace,
    ExerciseInWorkoutReplaceResponse,
)
from cache_groups import CacheGroup, mark_cache_group
from services.postgres.exercise_in_workout_actions import (
    postgres_create_exercise_in_workout,
    postgres_delete_exercise_in_workout,
    postgres_get_exercise_in_workout,
    postgres_list_exercises_in_workout,
    postgres_patch_exercise_in_workout,
    postgres_replace_exercise_in_workout,
)

router = APIRouter(prefix="/exercises_in_workout", tags=["exercises_in_workout"])

SortBy = Literal["order_index", "created_at"]
SortOrder = Literal["asc", "desc"]


@router.post(
    "/",
    response_model=ExerciseInWorkoutCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
@mark_cache_group(CacheGroup.HOT0)
async def create_exercise_in_workout(
    body: ExerciseInWorkoutCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Создать упражнение в тренировке."""
    return await postgres_create_exercise_in_workout(session, body, auth_user)


@router.get("/", response_model=list[ExerciseInWorkoutOut])
@mark_cache_group(CacheGroup.HOT0)
async def list_exercises_in_workout(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    owner: str | None = Query(
        default=None,
        description=(
            "Фильтр по владельцу тренировки (users.id). Admin: опционально. "
            "User: только свой id (или не указывать). Trainer: свой id или id подопечного."
        ),
    ),
    workout_id: int | None = Query(
        default=None, ge=0, description="Фильтр по тренировке (workouts.id)"
    ),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    sort: SortBy = Query(default="order_index"),
    order: SortOrder = Query(default="asc"),
):
    """Список упражнений в тренировках с учетом прав доступа по роли."""
    return await postgres_list_exercises_in_workout(
        session,
        auth_user,
        owner=owner,
        workout_id=workout_id,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
    )


@router.get("/{item_id}", response_model=ExerciseInWorkoutOut)
@mark_cache_group(CacheGroup.HOT0)
async def get_exercise_in_workout(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Получить запись упражнения в тренировке по id."""
    return await postgres_get_exercise_in_workout(session, item_id, auth_user)


@router.put("/{item_id}", response_model=ExerciseInWorkoutReplaceResponse)
async def replace_exercise_in_workout(
    item_id: Annotated[int, Path(ge=0)],
    body: ExerciseInWorkoutReplace,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Полная замена записи упражнения в тренировке."""
    return await postgres_replace_exercise_in_workout(session, item_id, body, auth_user)


@router.patch("/{item_id}", response_model=ExerciseInWorkoutPatchResponse)
async def patch_exercise_in_workout(
    item_id: Annotated[int, Path(ge=0)],
    body: ExerciseInWorkoutPatch,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Частичное обновление: меняются только переданные поля."""
    return await postgres_patch_exercise_in_workout(session, item_id, body, auth_user)


@router.delete("/{item_id}", response_model=ExerciseInWorkoutDeleteResponse)
async def delete_exercise_in_workout(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Удалить запись упражнения в тренировке."""
    return await postgres_delete_exercise_in_workout(session, item_id, auth_user)
