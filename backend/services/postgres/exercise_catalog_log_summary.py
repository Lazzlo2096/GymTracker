"""Агрегаты подходов для каталога (экран «Каталог упражнений»)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import ExerciseInCatalog, ExerciseInWorkout, Workout
from db.models.postgres.user import User as PgUser
from schemas.exercise_catalog_log_summary import (
    CatalogExerciseSetHistoryDay,
    CatalogExerciseSetHistoryOut,
    CatalogExerciseSetHistoryPoint,
    CatalogLogSummaryOut,
    CatalogTotals,
    ExerciseLogStats,
)
from services.postgres.catalog_access import (
    can_access_catalog_owner,
    resolve_catalog_scope_user_ids,
)
from utils.weight_composition import resolve_weight_kg


def _weight_kg(entry: dict[str, Any]) -> float | None:
    return resolve_weight_kg(entry)


def _reps(entry: dict[str, Any]) -> int | None:
    r = entry.get("reps")
    if r is None:
        return None

    try:
        return int(r)
    except (TypeError, ValueError):
        return None


def _reached_failure(entry: dict[str, Any]) -> bool | None:
    value = entry.get("reached_failure")
    return value if isinstance(value, bool) else None


def _effort_level(entry: dict[str, Any]) -> str | None:
    value = entry.get("effort_level")
    return value.strip() if isinstance(value, str) and value.strip() else None


def _string_or_none(entry: dict[str, Any], key: str) -> str | None:
    value = entry.get(key)
    return value if isinstance(value, str) else None


def _int_or_none(entry: dict[str, Any], key: str) -> int | None:
    value = entry.get(key)
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _dict_or_none(entry: dict[str, Any], key: str) -> dict[str, Any] | None:
    value = entry.get(key)
    return value if isinstance(value, dict) else None


def _is_working_set_row(d: dict[str, Any]) -> bool:
    if d.get("mark_type") in ("start", "end"):
        return False
    if d.get("type") == "mark":
        return False
    if d.get("type") in ("rest", "comment"):
        return False
    if d.get("type") == "set":
        return True

    wf = _weight_kg(d)
    ri = _reps(d)

    return wf is not None or ri is not None


def _parse_working_sets(sets_json: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for raw in sets_json or []:
        if not isinstance(raw, dict):
            continue
        if not _is_working_set_row(raw):
            continue
        out.append(raw)
    return out


async def postgres_catalog_exercise_set_history(
    session: AsyncSession,
    auth_user: PgUser,
    *,
    item_id: int,
) -> CatalogExerciseSetHistoryOut:
    """История рабочих подходов по дням для одного упражнения из каталога."""

    catalog_row = await session.get(ExerciseInCatalog, item_id)
    if not catalog_row:
        raise HTTPException(status_code=404, detail="Not found")

    if not await can_access_catalog_owner(session, auth_user, catalog_row.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    stmt = (
        select(ExerciseInWorkout, Workout)
        .join(Workout, Workout.id == ExerciseInWorkout.workout_id)
        .where(
            Workout.user_id == auth_user.id,
            ExerciseInWorkout.exercise_in_catalog_id == item_id,
        )
        .order_by(Workout.workout_date.asc(), ExerciseInWorkout.order_index.asc())
    )
    rows = (await session.execute(stmt)).all()

    by_day: dict[date, dict[str, Any]] = {}
    points: list[CatalogExerciseSetHistoryPoint] = []

    for exercise_row, workout_row in rows:
        pairs = _parse_working_sets(list(exercise_row.sets_json or []))
        if not pairs:
            continue

        day = workout_row.workout_date
        bucket = by_day.setdefault(
            day,
            {
                "workout_ids": [],
                "exercise_in_workout_ids": [],
                "sets_count": 0,
                "reps_total": 0,
                "tonnage_kg": 0.0,
                "max_weight_kg": None,
            },
        )

        if workout_row.id not in bucket["workout_ids"]:
            bucket["workout_ids"].append(workout_row.id)
        bucket["exercise_in_workout_ids"].append(exercise_row.id)
        bucket["sets_count"] += len(pairs)

        for set_index, raw_set in enumerate(pairs, start=1):
            weight_kg = _weight_kg(raw_set)
            reps = _reps(raw_set)
            points.append(
                CatalogExerciseSetHistoryPoint(
                    workout_date=day,
                    workout_id=workout_row.id,
                    exercise_in_workout_id=exercise_row.id,
                    set_number=set_index,
                    weight_kg=weight_kg,
                    weight_string=_string_or_none(raw_set, "weight_string"),
                    weight_composition=_dict_or_none(raw_set, "weight_composition"),
                    reps=reps,
                    reps_string=_string_or_none(raw_set, "reps_string"),
                    comment=_string_or_none(raw_set, "comment"),
                    set_seconds=_int_or_none(raw_set, "set_seconds"),
                    heart_rate_right_after=_int_or_none(
                        raw_set,
                        "heart_rate_right_after",
                    ),
                    rating=_int_or_none(raw_set, "rating"),
                    reached_failure=_reached_failure(raw_set),
                    effort_level=_effort_level(raw_set),
                )
            )

            if reps is not None and reps > 0:
                bucket["reps_total"] += reps
            if weight_kg is not None:
                current_max = bucket["max_weight_kg"]
                bucket["max_weight_kg"] = (
                    weight_kg if current_max is None else max(current_max, weight_kg)
                )
            if (
                weight_kg is not None
                and reps is not None
                and weight_kg > 0
                and reps > 0
            ):
                bucket["tonnage_kg"] += weight_kg * reps

    days = [
        CatalogExerciseSetHistoryDay(
            workout_date=day,
            workout_ids=list(data["workout_ids"]),
            exercise_in_workout_ids=list(data["exercise_in_workout_ids"]),
            sets_count=int(data["sets_count"]),
            reps_total=int(data["reps_total"]),
            tonnage_kg=round(float(data["tonnage_kg"]), 1),
            max_weight_kg=data["max_weight_kg"],
        )
        for day, data in sorted(by_day.items(), key=lambda item: item[0])
    ]

    return CatalogExerciseSetHistoryOut(
        exercise_in_catalog_id=item_id,
        name=catalog_row.name,
        total_days=len(days),
        total_sets=len(points),
        days=days,
        points=points,
    )


async def postgres_catalog_log_summary(
    session: AsyncSession,
    auth_user: PgUser,
    *,
    owner: str | None = None,
) -> CatalogLogSummaryOut:
    """
    Сводка и показатели по упражнениям.

    Журнал подходов — из тренировок текущего пользователя (его user_id).
    Число записей в каталоге — по scope списка каталога (owner / роль).
    """
    scope = await resolve_catalog_scope_user_ids(session, auth_user, owner)

    cnt_stmt = select(func.count()).select_from(ExerciseInCatalog)
    if scope is not None:
        cnt_stmt = cnt_stmt.where(ExerciseInCatalog.user_id.in_(scope))
    total_exercises = int((await session.execute(cnt_stmt)).scalar_one() or 0)

    stmt = (
        select(ExerciseInWorkout)
        .join(Workout, Workout.id == ExerciseInWorkout.workout_id)
        .where(
            Workout.user_id == auth_user.id,
            ExerciseInWorkout.exercise_in_catalog_id.isnot(None),
        )
    )
    result = await session.execute(stmt)
    eiw_rows = list(result.scalars().all())

    per_cat_pairs: dict[int, list[dict[str, Any]]] = defaultdict(list)
    per_cat_planned_hint: dict[int, int] = {}
    global_pairs: list[dict[str, Any]] = []

    min_dt = datetime.min.replace(tzinfo=timezone.utc)

    def _created_sort_key(r: ExerciseInWorkout) -> datetime:
        return r.created_at if r.created_at is not None else min_dt

    for row in sorted(eiw_rows, key=_created_sort_key):
        cid = row.exercise_in_catalog_id
        if cid is None:
            continue

        pairs = _parse_working_sets(list(row.sets_json or []))
        per_cat_pairs[cid].extend(pairs)
        global_pairs.extend(pairs)

        planned = row.planned_sets
        if planned is not None and planned > 0:
            per_cat_planned_hint[cid] = int(planned)

    total_sets = len(global_pairs)
    weights = [
        weight
        for item in global_pairs
        if (weight := _weight_kg(item)) is not None
    ]
    max_weight = max(weights) if weights else None
    tonnage = 0.0
    for item in global_pairs:
        w = _weight_kg(item)
        r = _reps(item)
        if w is not None and r is not None and w > 0 and r > 0:
            tonnage += float(w) * float(r)

    all_cat_ids = set(per_cat_pairs.keys()) | set(per_cat_planned_hint.keys())
    by_exercise: list[ExerciseLogStats] = []
    for cid in sorted(all_cat_ids):
        pairs = per_cat_pairs.get(cid, [])
        tw = [weight for item in pairs if (weight := _weight_kg(item)) is not None]
        tr = [reps for item in pairs if (reps := _reps(item)) is not None]
        best = max(tw) if tw else None
        rmin = min(tr) if tr else None
        rmax = max(tr) if tr else None
        by_exercise.append(
            ExerciseLogStats(
                exercise_in_catalog_id=cid,
                total_sets=len(pairs),
                best_weight_kg=best,
                reps_min=rmin,
                reps_max=rmax,
                planned_sets_hint=per_cat_planned_hint.get(cid),
            )
        )

    totals = CatalogTotals(
        total_exercises=total_exercises,
        total_sets=total_sets,
        max_weight_kg=max_weight,
        tonnage_kg=round(tonnage, 1),
    )
    return CatalogLogSummaryOut(totals=totals, by_exercise=by_exercise)
