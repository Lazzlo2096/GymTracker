"""Workout-specific action endpoints (add exercise to workout, etc.)."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends, Path, Query, status

from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from cache_groups import CacheGroup
from utils.cache import CACHE_WORKOUT_EXPIRE_SECONDS, cached_get, ns
from schemas.workout import (
    AddExerciseToWorkoutResponse,
    WorkoutCreate,
    WorkoutCreateResponse,
    WorkoutDeleteResponse,
    WorkoutRepeatBody,
    WorkoutRepeatResponse,
    WorkoutOut,
    WorkoutOutPaginatedList,
    WorkoutPatch,
    WorkoutPatchResponse,
    WorkoutReplace,
    WorkoutReplaceResponse,
)
from services.postgres.workout_actions import (
    postgres_add_exercise_to_workout,
    postgres_create_workout,
    postgres_delete_workout,
    postgres_repeat_workout,
    postgres_get_workout,
    postgres_list_workouts,
    postgres_patch_workout,
    postgres_replace_workout,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])

WorkoutSortBy = Literal["workout_date", "tonnage", "created_at"]
SortOrder = Literal["asc", "desc"]


@router.get("/", response_model=WorkoutOutPaginatedList)
@cached_get(
    namespace=ns.list_workouts,
    expire=CACHE_WORKOUT_EXPIRE_SECONDS,
    cache_group=CacheGroup.HOT1,
)
async def list_workouts(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    user: str | None = Query(
        default=None,
        description=(
            "Фильтр по владельцу тренировки (users.id). Admin: опционально. "
            "User: только свой id (или не указывать). Trainer: свой id или id подопечного."
        ),
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort: WorkoutSortBy = Query(default="workout_date"),
    order: SortOrder = Query(default="desc"),
    date_from: date | None = Query(
        default=None, description="Начало диапазона дат тренировки"
    ),
    date_to: date | None = Query(
        default=None, description="Конец диапазона дат тренировки"
    ),
    gym_name: str | None = Query(
        default=None,
        description="Подстрока в названии зала (user_gyms.name, без учёта регистра)",
    ),
    q: str | None = Query(
        default=None,
        description="Поиск по названию дня, заметке или названию зала",
    ),
    day_title_contains: str | None = Query(
        default=None,
        description="Фильтр по заголовку дня (тип/фокус тренировки), подстрока",
    ),
):
    """
    Пагинированный список тренировок (требуется access token).
    Подгружаются только запрошенные строки; тоннаж считается в БД по JSON-подходам.
    """
    return await postgres_list_workouts(
        session,
        auth_user,
        user,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
        date_from=date_from,
        date_to=date_to,
        gym_name=gym_name,
        q=q,
        day_title_contains=day_title_contains,
    )


@router.post(
    "/", status_code=status.HTTP_201_CREATED, response_model=WorkoutCreateResponse
)
async def create_workout(
    body: WorkoutCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """
    Создание тренировки для текущего авторизованного пользователя.
    user_id берём из access token (через get_current_user), а не из body.
    """
    return await postgres_create_workout(
        session,
        user_id=auth_user.id,
        workout_date=body.workout_date,
        day_title=body.day_title,
        note=body.note,
        user_gym_id=body.user_gym_id,
    )


@router.get("/{workout_id}", response_model=WorkoutOut)
@cached_get(
    namespace=ns.get_workout,
    expire=CACHE_WORKOUT_EXPIRE_SECONDS,
    cache_group=CacheGroup.HOT1,
)
async def get_workout(
    workout_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Одна тренировка по id (только если доступна по правилам ролей)."""
    return await postgres_get_workout(session, workout_id, auth_user)


@router.put("/{workout_id}", response_model=WorkoutReplaceResponse)
async def replace_workout(
    workout_id: Annotated[int, Path(ge=0)],
    body: WorkoutReplace,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Полная замена тренировки: требуются все поля схемы."""
    return await postgres_replace_workout(session, workout_id, body, auth_user)


@router.patch("/{workout_id}", response_model=WorkoutPatchResponse)
async def patch_workout(
    workout_id: Annotated[int, Path(ge=0)],
    body: WorkoutPatch,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Частичное обновление тренировки: меняются только переданные поля."""
    return await postgres_patch_workout(session, workout_id, body, auth_user)


@router.delete("/{workout_id}", response_model=WorkoutDeleteResponse)
async def delete_workout(
    workout_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Удаление тренировки по id."""
    return await postgres_delete_workout(session, workout_id, auth_user)


@router.post(
    "/{workout_id}/repeat",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkoutRepeatResponse,
)
async def repeat_workout(
    workout_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    body: WorkoutRepeatBody | None = Body(default=None),
):
    """
    Повторить тренировку: новая запись на другую дату с пустым sets_json
    и planned_sets_json из фактических подходов и отдыхов исходной тренировки.
    """
    overrides = body or WorkoutRepeatBody()
    return await postgres_repeat_workout(
        session,
        workout_id,
        auth_user,
        workout_date=overrides.workout_date,
        day_title=overrides.day_title,
    )


@router.post(
    "/{workout_id}/add_exercise/{exercise_id}",
    response_model=AddExerciseToWorkoutResponse,
)
async def add_exercise_to_workout(
    workout_id: Annotated[int, Path(ge=0)],
    exercise_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """workout_id и exercise_id — целые id (PostgreSQL)."""
    return await postgres_add_exercise_to_workout(
        session,
        workout_id,
        exercise_id,
        auth_user,
    )
