"""Статистика: календарь активности и серии из реальных workouts."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres.exercise_in_workout import ExerciseInWorkout
from db.models.postgres.workout import Workout
from schemas.stats import (
    ActivityHeatmapDayOut,
    ActivityHeatmapOut,
    ActivityHeatmapRangeOut,
    BestStreakOut,
    StreaksRhythmOut,
)

_BEST_STREAKS_LIMIT = 5
_INTENSITY_HEAVY_EXERCISES = 4


def _iso(day: date) -> str:
    return day.isoformat()


def intensity_for_exercise_count(exercise_count: int) -> Literal[1, 2]:
    """1 — лёгкий день, 2 — насыщенный (≥4 упражнений суммарно за день)."""
    return 2 if exercise_count >= _INTENSITY_HEAVY_EXERCISES else 1


def compute_current_streak_days(active_days: set[date], today: date) -> int:
    """
    Текущая серия для UI: если сегодня есть тренировка — считаем от сегодня,
    иначе от вчера; обрыв дня без тренировки останавливает счёт.
    """
    if not active_days:
        return 0

    cursor = today if today in active_days else today - timedelta(days=1)
    streak = 0
    while cursor in active_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def compute_best_streaks(
    active_days: set[date],
    *,
    limit: int = _BEST_STREAKS_LIMIT,
) -> list[BestStreakOut]:
    """Лучшие непрерывные серии по календарным датам тренировок."""
    if not active_days:
        return []

    ordered = sorted(active_days)
    runs: list[tuple[date, date, int]] = []
    run_start = ordered[0]
    prev = ordered[0]

    for day in ordered[1:]:
        if day == prev + timedelta(days=1):
            prev = day
            continue
        runs.append((run_start, prev, (prev - run_start).days + 1))
        run_start = day
        prev = day

    runs.append((run_start, prev, (prev - run_start).days + 1))
    runs.sort(key=lambda item: (-item[2], -item[1].toordinal()))

    return [
        BestStreakOut(start=start, end=end, days=days)
        for start, end, days in runs[:limit]
    ]


def resolve_heatmap_range(
    *,
    today: date,
    date_from: date | None,
    date_to: date | None,
) -> tuple[date | None, date | None]:
    """
    Явные границы фильтра.
    Оба None → (None, None) = всё время (см. get_activity_heatmap_for_user).
    """
    if date_from is None and date_to is None:
        return None, None

    end = date_to if date_to is not None else today
    start = date_from if date_from is not None else None
    return start, end


async def _load_workout_day_stats(
    session: AsyncSession,
    user_id: int,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[tuple[int, date, str | None, int]]:
    """Строки: workout_id, workout_date, note, exercises_count."""
    stmt = (
        select(
            Workout.id,
            Workout.workout_date,
            Workout.note,
            func.count(ExerciseInWorkout.id),
        )
        .outerjoin(
            ExerciseInWorkout,
            ExerciseInWorkout.workout_id == Workout.id,
        )
        .where(Workout.user_id == user_id)
        .group_by(Workout.id, Workout.workout_date, Workout.note)
        .order_by(Workout.workout_date.asc(), Workout.id.asc())
    )
    if date_from is not None:
        stmt = stmt.where(Workout.workout_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Workout.workout_date <= date_to)

    rows = (await session.execute(stmt)).all()
    return [
        (int(workout_id), workout_date, note, int(exercise_count or 0))
        for workout_id, workout_date, note, exercise_count in rows
    ]


def build_activity_heatmap_from_rows(
    rows: list[tuple[int, date, str | None, int]],
    *,
    range_start: date,
    range_end: date,
) -> ActivityHeatmapOut:
    exercises_by_day: dict[date, int] = defaultdict(int)
    note_by_day: dict[date, str] = {}

    for _workout_id, workout_date, note, exercise_count in rows:
        if workout_date < range_start or workout_date > range_end:
            continue
        exercises_by_day[workout_date] += exercise_count
        if note and note.strip():
            # Более поздний workout (больший id, т.к. rows упорядочены) перезапишет.
            note_by_day[workout_date] = note.strip()

    days: dict[str, ActivityHeatmapDayOut] = {}
    for day, count in exercises_by_day.items():
        day_key = _iso(day)
        days[day_key] = ActivityHeatmapDayOut(
            intensity=intensity_for_exercise_count(count),
            note=note_by_day.get(day),
        )

    return ActivityHeatmapOut(
        range=ActivityHeatmapRangeOut(start=range_start, end=range_end),
        days=days,
    )


async def get_activity_heatmap_for_user(
    session: AsyncSession,
    user_id: int,
    *,
    today: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> ActivityHeatmapOut:
    day_today = today or date.today()
    filter_from, filter_to = resolve_heatmap_range(
        today=day_today,
        date_from=date_from,
        date_to=date_to,
    )

    rows = await _load_workout_day_stats(
        session,
        user_id,
        date_from=filter_from,
        date_to=filter_to,
    )

    if filter_from is None and filter_to is None:
        # Всё время: сетка от первой тренировки до сегодня (или сегодня..сегодня, если пусто).
        if not rows:
            return ActivityHeatmapOut(
                range=ActivityHeatmapRangeOut(start=day_today, end=day_today),
                days={},
            )
        workout_dates = [workout_date for _wid, workout_date, _note, _ex in rows]
        range_start = min(workout_dates)
        range_end = max(day_today, max(workout_dates))
    else:
        range_start = filter_from if filter_from is not None else (
            min((r[1] for r in rows), default=filter_to or day_today)
        )
        range_end = filter_to if filter_to is not None else day_today

    return build_activity_heatmap_from_rows(
        rows,
        range_start=range_start,
        range_end=range_end,
    )


async def get_streaks_rhythm_for_user(
    session: AsyncSession,
    user_id: int,
    *,
    today: date | None = None,
) -> StreaksRhythmOut:
    day_today = today or date.today()
    rows = await _load_workout_day_stats(session, user_id)
    active_days = {workout_date for _wid, workout_date, _note, _ex in rows}

    return StreaksRhythmOut(
        current_streak_days=compute_current_streak_days(active_days, day_today),
        best_streaks=compute_best_streaks(active_days),
    )
