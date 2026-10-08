"""Длительность тренировки: START первого упражнения → END последнего (или «сейчас», если ещё идёт)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _coerce_aware_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return _coerce_aware_utc(value)
    if isinstance(value, str) and value.strip():
        raw = value.strip().replace("Z", "+00:00")
        try:
            return _coerce_aware_utc(datetime.fromisoformat(raw))
        except ValueError:
            return None
    return None


def _get_field(item: Any, key: str) -> Any:
    if isinstance(item, dict):
        return item.get(key)
    return getattr(item, key, None)


def _exercise_order_index(exercise: Any, fallback: int = 0) -> int:
    raw = _get_field(exercise, "order_index")
    if isinstance(raw, int):
        return raw
    return fallback


def _iter_sets(exercise: Any) -> list[Any]:
    sets = _get_field(exercise, "sets_json")
    if sets is None:
        sets = _get_field(exercise, "timeline")
    return list(sets or [])


def exercise_start_datetime(exercise: Any) -> datetime | None:
    """START первого упражнения: метка mark/start в sets_json или start_time."""
    for item in _iter_sets(exercise):
        if (
            _get_field(item, "type") == "mark"
            and _get_field(item, "mark_type") == "start"
        ):
            dt = _parse_datetime(_get_field(item, "datetime"))
            if dt is not None:
                return dt
    return _parse_datetime(_get_field(exercise, "start_time"))


def exercise_end_datetime(exercise: Any) -> datetime | None:
    """END последнего упражнения: последняя метка mark/end в sets_json или end_time."""
    for item in reversed(_iter_sets(exercise)):
        if (
            _get_field(item, "type") == "mark"
            and _get_field(item, "mark_type") == "end"
        ):
            dt = _parse_datetime(_get_field(item, "datetime"))
            if dt is not None:
                return dt
    return _parse_datetime(_get_field(exercise, "end_time"))


def _mark_kind(item: Any) -> str | None:
    mark_type = _get_field(item, "mark_type")
    if mark_type in ("start", "end"):
        return mark_type
    if _get_field(item, "type") == "mark" and mark_type in ("start", "end"):
        return mark_type
    return None


def is_exercise_active(exercise: Any) -> bool:
    """True, если в sets_json есть открытый START без последующего END."""
    open_session = False
    for item in _iter_sets(exercise):
        kind = _mark_kind(item)
        if kind == "start":
            open_session = True
        elif kind == "end":
            open_session = False
    return open_session


def is_workout_active(exercises: list[Any]) -> bool:
    """True, если хотя бы одно упражнение в тренировке is_active."""
    return any(is_exercise_active(exercise) for exercise in exercises)


def compute_workout_duration_minutes(
    exercises: list[Any],
    *,
    now: datetime | None = None,
) -> int | None:
    """
    Минуты от START первого упражнения (по order_index) до END последнего.
    Если у последнего упражнения нет END — до `now` (тренировка в процессе).
    """
    if not exercises:
        return None

    sorted_exercises = sorted(
        enumerate(exercises),
        key=lambda pair: _exercise_order_index(pair[1], pair[0]),
    )
    first_exercise = sorted_exercises[0][1]
    last_exercise = sorted_exercises[-1][1]

    start = exercise_start_datetime(first_exercise)
    if start is None:
        return None

    end = exercise_end_datetime(last_exercise)
    if end is None:
        end = now or datetime.now(timezone.utc)
    else:
        end = _coerce_aware_utc(end)

    seconds = max(0.0, (end - start).total_seconds())
    return int(seconds // 60)


def is_workout_duration_in_progress(exercises: list[Any]) -> bool:
    """True, если duration_minutes считается до текущего момента (нет END у последнего упражнения)."""
    if not exercises:
        return False

    sorted_exercises = sorted(
        enumerate(exercises),
        key=lambda pair: _exercise_order_index(pair[1], pair[0]),
    )
    first_exercise = sorted_exercises[0][1]
    last_exercise = sorted_exercises[-1][1]

    if exercise_start_datetime(first_exercise) is None:
        return False
    return exercise_end_datetime(last_exercise) is None
