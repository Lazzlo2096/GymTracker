"""Агрегаты /stats: overview, top-exercises, gym-visits, workout-types."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select

from db.models.postgres.exercise_in_catalog import ExerciseInCatalog
from db.models.postgres.exercise_in_workout import ExerciseInWorkout
from db.models.postgres.user_gym import UserGym
from db.models.postgres.workout import Workout
from schemas.exercise_type import EXERCISE_TYPE_LABELS_RU, ExerciseType
from schemas.stats import (
    StatsBucketId,
    StatsChartPointOut,
    StatsGymVisitOut,
    StatsGymVisitsOut,
    StatsKpiOut,
    StatsOverviewOut,
    StatsPeriodId,
    StatsTopExerciseOut,
    StatsTopExercisesOut,
    StatsWorkoutTypeSliceOut,
    StatsWorkoutTypesOut,
)
from services.postgres.exercise_catalog_log_summary import (
    _parse_working_sets,
    _reps,
    _weight_kg,
)
from services.postgres.stats_period import (
    STATS_PERIOD_LABELS_RU,
    default_bucket_for_period,
    infer_stats_period_id,
    previous_bounds_from_range,
)
from utils.workout_duration import compute_workout_duration_minutes

_WEEKDAY_LABELS_RU = ("пн", "вт", "ср", "чт", "пт", "сб", "вс")
_MONTH_LABELS_RU = (
    "янв.",
    "февр.",
    "мар.",
    "апр.",
    "май",
    "июн.",
    "июл.",
    "авг.",
    "сент.",
    "окт.",
    "нояб.",
    "дек.",
)
_QUARTER_LABELS_RU = ("I кв.", "II кв.", "III кв.", "IV кв.")


@dataclass
class _WorkoutAgg:
    workout_date: date
    exercise_count: int = 0
    duration_minutes: int = 0
    tonnage_kg: float = 0.0
    gym_id: int | None = None
    type_id: str = "other"


@dataclass
class _WindowTotals:
    workouts: int = 0
    exercises: int = 0
    duration_minutes: int = 0
    tonnage_kg: float = 0.0
    by_day: dict[date, _DayBucket] = field(default_factory=dict)


@dataclass
class _DayBucket:
    sessions: int = 0
    exercises: int = 0
    duration_minutes: int = 0
    tonnage_kg: float = 0.0


def _workout_tonnage_kg(exercises: list[Any]) -> float:
    total = 0.0
    for exercise in exercises:
        for entry in _parse_working_sets(list(exercise.sets_json or [])):
            weight = _weight_kg(entry)
            reps = _reps(entry)
            if weight is None or reps is None:
                continue
            total += float(weight) * float(reps)
    return total


def _derive_workout_type_id(exercises: list[Any]) -> str:
    found: list[str] = []
    for exercise in exercises:
        catalog = getattr(exercise, "exercise", None)
        raw = getattr(catalog, "exercise_type", None) if catalog is not None else None
        if isinstance(raw, str) and raw.strip():
            found.append(raw.strip())
    unique = sorted(set(found))
    if not unique:
        return "other"
    if len(unique) >= 2:
        return "mixed"
    return unique[0]


def _type_label(type_id: str) -> str:
    if type_id == "mixed":
        return "Смешанная"
    try:
        return EXERCISE_TYPE_LABELS_RU[ExerciseType(type_id)]
    except ValueError:
        return "Другое"


def _format_delta(current: float, previous: float | None, *, kind: str) -> str:
    if previous is None:
        return "за всё время"
    delta = current - previous
    if abs(delta) < 0.05:
        return "без изменений"
    if kind == "tonnage":
        if previous > 0:
            pct = round((delta / previous) * 100)
            sign = "+" if pct > 0 else ""
            return f"{sign}{pct}% к прошлому периоду"
        sign = "+" if delta > 0 else ""
        return f"{sign}{round(delta)} кг к прошлому периоду"
    if kind == "duration":
        minutes = int(round(delta))
        sign = "+" if minutes > 0 else ""
        return f"{sign}{minutes} мин к прошлому периоду"
    value = int(round(delta))
    sign = "+" if value > 0 else ""
    return f"{sign}{value} к прошлому периоду"


def _apply_date_filters(
    stmt: Select,
    *,
    date_from: date | None,
    date_to: date | None,
) -> Select:
    if date_from is not None:
        stmt = stmt.where(Workout.workout_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Workout.workout_date <= date_to)
    return stmt


async def _load_workout_aggs(
    session: AsyncSession,
    user_id: int,
    *,
    date_from: date | None,
    date_to: date | None,
) -> list[_WorkoutAgg]:
    stmt = (
        select(Workout)
        .where(Workout.user_id == user_id)
        .options(
            selectinload(Workout.exercises).selectinload(ExerciseInWorkout.exercise)
        )
        .order_by(Workout.workout_date.asc(), Workout.id.asc())
    )
    stmt = _apply_date_filters(stmt, date_from=date_from, date_to=date_to)
    workouts = list((await session.scalars(stmt)).unique().all())

    result: list[_WorkoutAgg] = []
    for workout in workouts:
        exercises = list(workout.exercises or [])
        duration = compute_workout_duration_minutes(exercises) or 0
        result.append(
            _WorkoutAgg(
                workout_date=workout.workout_date,
                exercise_count=len(exercises),
                duration_minutes=int(duration),
                tonnage_kg=_workout_tonnage_kg(exercises),
                gym_id=workout.user_gym_id,
                type_id=_derive_workout_type_id(exercises),
            )
        )
    return result


def _totals_from_aggs(aggs: list[_WorkoutAgg]) -> _WindowTotals:
    totals = _WindowTotals()
    for agg in aggs:
        totals.workouts += 1
        totals.exercises += agg.exercise_count
        totals.duration_minutes += agg.duration_minutes
        totals.tonnage_kg += agg.tonnage_kg
        bucket = totals.by_day.setdefault(agg.workout_date, _DayBucket())
        bucket.sessions += 1
        bucket.exercises += agg.exercise_count
        bucket.duration_minutes += agg.duration_minutes
        bucket.tonnage_kg += agg.tonnage_kg
    return totals


def _build_kpi(
    current: _WindowTotals,
    previous: _WindowTotals | None,
    *,
    period: StatsPeriodId,
) -> StatsKpiOut:
    prev = previous
    if period == "all":
        prev = None
    return StatsKpiOut(
        workouts=current.workouts,
        duration_minutes=current.duration_minutes,
        tonnage_kg=round(current.tonnage_kg, 1),
        exercises=current.exercises,
        delta_workouts=_format_delta(
            current.workouts, None if prev is None else prev.workouts, kind="count"
        ),
        delta_duration=_format_delta(
            current.duration_minutes,
            None if prev is None else prev.duration_minutes,
            kind="duration",
        ),
        delta_tonnage=_format_delta(
            current.tonnage_kg,
            None if prev is None else prev.tonnage_kg,
            kind="tonnage",
        ),
        delta_exercises=_format_delta(
            current.exercises, None if prev is None else prev.exercises, kind="count"
        ),
    )


def _iter_bucket_keys(
    bucket: StatsBucketId,
    *,
    date_from: date,
    date_to: date,
) -> list[tuple[str, str | None, date, date]]:
    """
    Список бакетов: (label, sublabel, start_inclusive, end_inclusive).
    """
    start = date_from
    end = date_to
    keys: list[tuple[str, str | None, date, date]] = []

    if bucket == "day":
        use_weekday_labels = (end - start).days <= 8
        cursor = start
        while cursor <= end:
            if use_weekday_labels:
                label = _WEEKDAY_LABELS_RU[cursor.weekday()]
                sub = None
            else:
                label = str(cursor.day)
                sub = _MONTH_LABELS_RU[cursor.month - 1]
                if start.year != end.year:
                    sub = f"{sub} {cursor.year}"
            keys.append((label, sub, cursor, cursor))
            cursor += timedelta(days=1)
        return keys

    if bucket == "week":
        week_start = start - timedelta(days=start.weekday())
        while week_start <= end:
            week_end = week_start + timedelta(days=6)
            bucket_start = max(week_start, start)
            bucket_end = min(week_end, end)
            label = f"{bucket_start.day}"
            sub = _MONTH_LABELS_RU[bucket_start.month - 1]
            keys.append((label, sub, bucket_start, bucket_end))
            week_start += timedelta(days=7)
        return keys

    if bucket == "month":
        year, month = start.year, start.month
        while (year, month) <= (end.year, end.month):
            month_start = date(year, month, 1)
            if month == 12:
                month_end = date(year, 12, 31)
                next_year, next_month = year + 1, 1
            else:
                month_end = date(year, month + 1, 1) - timedelta(days=1)
                next_year, next_month = year, month + 1
            bucket_start = max(month_start, start)
            bucket_end = min(month_end, end)
            keys.append(
                (
                    _MONTH_LABELS_RU[month - 1],
                    str(year) if start.year != end.year else None,
                    bucket_start,
                    bucket_end,
                )
            )
            year, month = next_year, next_month
        return keys

    if bucket == "quarter":
        year = start.year
        quarter = (start.month - 1) // 3
        while (year, quarter) <= (end.year, (end.month - 1) // 3):
            q_start_month = quarter * 3 + 1
            q_end_month = q_start_month + 2
            quarter_start = date(year, q_start_month, 1)
            if q_end_month == 12:
                quarter_end = date(year, 12, 31)
            else:
                quarter_end = date(year, q_end_month + 1, 1) - timedelta(days=1)
            bucket_start = max(quarter_start, start)
            bucket_end = min(quarter_end, end)
            keys.append(
                (
                    _QUARTER_LABELS_RU[quarter],
                    str(year),
                    bucket_start,
                    bucket_end,
                )
            )
            quarter += 1
            if quarter > 3:
                quarter = 0
                year += 1
        return keys

    # year
    for year in range(start.year, end.year + 1):
        keys.append((str(year), None, date(year, 1, 1), date(year, 12, 31)))
    return keys


def _sum_metric(bucket: _DayBucket, metric: str) -> float:
    if metric == "sessions":
        return float(bucket.sessions)
    if metric == "duration":
        return float(bucket.duration_minutes)
    if metric == "tonnage":
        return float(bucket.tonnage_kg)
    return float(bucket.exercises)


def _build_series(
    bucket: StatsBucketId,
    totals: _WindowTotals,
    *,
    date_from: date | None,
    date_to: date | None,
) -> dict[str, list[StatsChartPointOut]]:
    metrics = ("sessions", "duration", "tonnage", "exercises")
    if date_from is None or date_to is None:
        if not totals.by_day:
            return {m: [] for m in metrics}
        series_from = date_from if date_from is not None else min(totals.by_day)
        series_to = date_to if date_to is not None else max(totals.by_day)
    else:
        series_from = date_from
        series_to = date_to

    buckets = _iter_bucket_keys(bucket, date_from=series_from, date_to=series_to)

    series: dict[str, list[StatsChartPointOut]] = {m: [] for m in metrics}
    for label, sublabel, b_start, b_end in buckets:
        for metric in metrics:
            value = 0.0
            cursor = b_start
            while cursor <= b_end:
                day_bucket = totals.by_day.get(cursor)
                if day_bucket is not None:
                    value += _sum_metric(day_bucket, metric)
                cursor += timedelta(days=1)
            if metric == "tonnage":
                value = round(value, 1)
            series[metric].append(
                StatsChartPointOut(label=label, sublabel=sublabel, value=value)
            )
    return series


async def get_stats_overview(
    session: AsyncSession,
    user_id: int,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    bucket: StatsBucketId | None = None,
) -> StatsOverviewOut:
    period = infer_stats_period_id(date_from, date_to)
    resolved_bucket = bucket or default_bucket_for_period(period)

    current_aggs = await _load_workout_aggs(
        session, user_id, date_from=date_from, date_to=date_to
    )
    current_totals = _totals_from_aggs(current_aggs)

    previous_totals: _WindowTotals | None = None
    if date_from is not None and date_to is not None and period != "all":
        prev_from, prev_to = previous_bounds_from_range(date_from, date_to)
        prev_aggs = await _load_workout_aggs(
            session, user_id, date_from=prev_from, date_to=prev_to
        )
        previous_totals = _totals_from_aggs(prev_aggs)

    return StatsOverviewOut(
        period=period,
        period_label=STATS_PERIOD_LABELS_RU[period],
        bucket=resolved_bucket,
        kpi=_build_kpi(current_totals, previous_totals, period=period),
        series=_build_series(
            resolved_bucket,
            current_totals,
            date_from=date_from,
            date_to=date_to,
        ),
    )


async def get_stats_top_exercises(
    session: AsyncSession,
    user_id: int,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 5,
) -> StatsTopExercisesOut:
    period = infer_stats_period_id(date_from, date_to)

    stmt = (
        select(ExerciseInWorkout, ExerciseInCatalog)
        .join(Workout, Workout.id == ExerciseInWorkout.workout_id)
        .join(
            ExerciseInCatalog,
            ExerciseInCatalog.id == ExerciseInWorkout.exercise_in_catalog_id,
        )
        .where(
            Workout.user_id == user_id,
            ExerciseInWorkout.exercise_in_catalog_id.is_not(None),
        )
    )
    stmt = _apply_date_filters(stmt, date_from=date_from, date_to=date_to)
    rows = (await session.execute(stmt)).all()

    stats: dict[int, dict[str, Any]] = {}
    for exercise_row, catalog_row in rows:
        entry = stats.setdefault(
            catalog_row.id,
            {
                "name": catalog_row.name,
                "sets": 0,
                "tonnage": 0.0,
                "best": 0.0,
            },
        )
        for raw in _parse_working_sets(list(exercise_row.sets_json or [])):
            entry["sets"] += 1
            weight = _weight_kg(raw)
            reps = _reps(raw)
            if weight is not None:
                entry["best"] = max(entry["best"], float(weight))
            if weight is not None and reps is not None:
                entry["tonnage"] += float(weight) * float(reps)

    ranked = sorted(
        stats.items(),
        key=lambda item: (-item[1]["sets"], -item[1]["tonnage"], item[1]["name"]),
    )[:limit]

    return StatsTopExercisesOut(
        period=period,
        items=[
            StatsTopExerciseOut(
                id=catalog_id,
                name=str(payload["name"]),
                sets=int(payload["sets"]),
                tonnage_kg=round(float(payload["tonnage"]), 1),
                best_weight_kg=round(float(payload["best"]), 1),
            )
            for catalog_id, payload in ranked
        ],
    )


async def get_stats_gym_visits(
    session: AsyncSession,
    user_id: int,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> StatsGymVisitsOut:
    period = infer_stats_period_id(date_from, date_to)

    stmt = (
        select(
            UserGym.id,
            UserGym.name,
            func.count(Workout.id),
            func.max(Workout.workout_date),
        )
        .join(Workout, Workout.user_gym_id == UserGym.id)
        .where(Workout.user_id == user_id, UserGym.user_id == user_id)
        .group_by(UserGym.id, UserGym.name)
        .order_by(func.count(Workout.id).desc(), UserGym.name.asc())
    )
    if date_from is not None:
        stmt = stmt.where(Workout.workout_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Workout.workout_date <= date_to)

    rows = (await session.execute(stmt)).all()
    return StatsGymVisitsOut(
        period=period,
        items=[
            StatsGymVisitOut(
                id=int(gym_id),
                name=str(name),
                visit_count=int(count or 0),
                last_workout_date=last_day if isinstance(last_day, date) else None,
            )
            for gym_id, name, count, last_day in rows
        ],
    )


async def get_stats_workout_types(
    session: AsyncSession,
    user_id: int,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> StatsWorkoutTypesOut:
    period = infer_stats_period_id(date_from, date_to)
    aggs = await _load_workout_aggs(
        session, user_id, date_from=date_from, date_to=date_to
    )
    counter: Counter[str] = Counter(agg.type_id for agg in aggs)
    total = sum(counter.values())
    if total <= 0:
        return StatsWorkoutTypesOut(period=period, items=[])

    items = [
        StatsWorkoutTypeSliceOut(
            id=type_id,
            label=_type_label(type_id),
            count=count,
            percent=int(round(100 * count / total)),
        )
        for type_id, count in counter.most_common()
    ]
    # Поправка округления процентов: сумма 100.
    drift = 100 - sum(item.percent for item in items)
    if items and drift != 0:
        items[0] = StatsWorkoutTypeSliceOut(
            id=items[0].id,
            label=items[0].label,
            count=items[0].count,
            percent=max(0, min(100, items[0].percent + drift)),
        )
    return StatsWorkoutTypesOut(period=period, items=items)
