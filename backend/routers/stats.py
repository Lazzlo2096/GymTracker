"""Статистика пользователя: календарь, серии, overview и срезы."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from cache_groups import CacheGroup, mark_cache_group
from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.stats import (
    ActivityHeatmapOut,
    StatsBucketId,
    StatsGymVisitsOut,
    StatsOverviewOut,
    StatsTopExercisesOut,
    StatsWorkoutTypesOut,
    StreaksRhythmOut,
)
from services.postgres.stats_actions import (
    get_activity_heatmap_for_user,
    get_streaks_rhythm_for_user,
)
from services.postgres.stats_overview_actions import (
    get_stats_gym_visits,
    get_stats_overview,
    get_stats_top_exercises,
    get_stats_workout_types,
)
from services.postgres.stats_period import date_bounds_from_datetimes
from utils.query_datetime import EndQuery, StartQuery, parse_query_datetime

router = APIRouter(prefix="/stats", tags=["stats"])


def _parse_stats_range(
    start: str | None,
    end: str | None,
) -> tuple[date | None, date | None]:
    start_dt = parse_query_datetime(start, field="start")
    end_dt = parse_query_datetime(end, field="end")
    if start_dt is not None and end_dt is not None and start_dt > end_dt:
        raise HTTPException(
            status_code=400,
            detail="start не может быть позже end",
        )
    return date_bounds_from_datetimes(start_dt, end_dt)


@router.get(
    "/activity-heatmap",
    response_model=ActivityHeatmapOut,
    summary="Календарь активности",
    description=(
        "Тепловая карта по реальным тренировкам текущего пользователя. "
        "days[date].intensity: 1 — до 3 упражнений за день, 2 — 4 и больше. "
        "days[date].note — комментарий тренировки, если есть. "
        "Без date_from/date_to — все тренировки пользователя "
        "(range от первой даты до сегодня)."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def get_activity_heatmap(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    date_from: date | None = Query(
        default=None,
        description="Начало диапазона календаря (YYYY-MM-DD)",
    ),
    date_to: date | None = Query(
        default=None,
        description="Конец диапазона календаря (YYYY-MM-DD)",
    ),
) -> ActivityHeatmapOut:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail="date_from не может быть позже date_to",
        )
    return await get_activity_heatmap_for_user(
        session,
        auth_user.id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get(
    "/streaks-rhythm",
    response_model=StreaksRhythmOut,
    summary="Серии и ритм",
    description=(
        "Текущая и лучшие серии по календарным датам тренировок "
        "текущего пользователя (до 5 лучших)."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def get_streaks_rhythm(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> StreaksRhythmOut:
    return await get_streaks_rhythm_for_user(session, auth_user.id)


@router.get(
    "/overview",
    response_model=StatsOverviewOut,
    summary="KPI и динамика за период",
    description=(
        "Фильтр по start/end (datetime). Без обоих — всё время. "
        "Формат: 2026-07-05T210000Z (дата с `-`, время без `:`). "
        "bucket — квант оси X: day | week | month | quarter | year "
        "(если не задан — выбирается по длине периода)."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def get_overview(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    start: StartQuery = None,
    end: EndQuery = None,
    bucket: Annotated[
        StatsBucketId | None,
        Query(
            description="Квант серии: day | week | month | quarter | year",
            examples=["month", "year", "quarter", "day"],
        ),
    ] = None,
) -> StatsOverviewOut:
    date_from, date_to = _parse_stats_range(start, end)
    return await get_stats_overview(
        session,
        auth_user.id,
        date_from=date_from,
        date_to=date_to,
        bucket=bucket,
    )


@router.get(
    "/top-exercises",
    response_model=StatsTopExercisesOut,
    summary="Топ упражнений за период",
)
@mark_cache_group(CacheGroup.NONE)
async def get_top_exercises(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    start: StartQuery = None,
    end: EndQuery = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> StatsTopExercisesOut:
    date_from, date_to = _parse_stats_range(start, end)
    return await get_stats_top_exercises(
        session,
        auth_user.id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )


@router.get(
    "/gym-visits",
    response_model=StatsGymVisitsOut,
    summary="Посещения залов за период",
)
@mark_cache_group(CacheGroup.NONE)
async def get_gym_visits(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    start: StartQuery = None,
    end: EndQuery = None,
) -> StatsGymVisitsOut:
    date_from, date_to = _parse_stats_range(start, end)
    return await get_stats_gym_visits(
        session,
        auth_user.id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get(
    "/workout-types",
    response_model=StatsWorkoutTypesOut,
    summary="Типы тренировок за период",
    description=(
        "Тип выводится из exercise_type упражнений в тренировке: "
        "один тип → он, несколько → mixed, нет типов → other."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def get_workout_types(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    start: StartQuery = None,
    end: EndQuery = None,
) -> StatsWorkoutTypesOut:
    date_from, date_to = _parse_stats_range(start, end)
    return await get_stats_workout_types(
        session,
        auth_user.id,
        date_from=date_from,
        date_to=date_to,
    )
