"""Преобразование выполненной тренировки в шаблон (план без лога подходов)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Iterable, Mapping, Optional, Sequence

from pydantic import TypeAdapter

from schemas.exercise_in_workout_set import SetScheme
from schemas.planned_set_timeline import (
    PlannedRestSetEntry,
    PlannedSetTimelineEntry,
    PlannedWorkoutSetEntry,
)
from schemas.workout_template import ExerciseInWorkoutTemplate, WorkoutTemplate

_set_adapter = TypeAdapter(SetScheme)


def _as_mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="python")
    raise TypeError(f"Ожидался dict или Pydantic-модель, получено: {type(value)!r}")


def log_entry_to_planned(
    entry: SetScheme | Mapping[str, Any],
) -> PlannedSetTimelineEntry | None:
    """
    Одна запись из sets_json → запись плана.

    Пропускает mark/comment и прочие служебные типы.
    """
    if not isinstance(entry, Mapping):
        entry = _as_mapping(entry)
    else:
        entry = dict(entry)

    entry_type = entry.get("type")
    if entry_type == "set":
        planned = PlannedWorkoutSetEntry(
            weight_kg=entry.get("weight_kg"),
            weight_string=entry.get("weight_string"),
            reps=entry.get("reps"),
            reps_string=entry.get("reps_string"),
        )
        if (
            planned.weight_kg is None
            and not planned.weight_string
            and planned.reps is None
            and not planned.reps_string
        ):
            return None
        return planned

    if entry_type == "rest":
        rest_seconds = entry.get("rest_seconds")
        if rest_seconds is None:
            return None
        return PlannedRestSetEntry(rest_seconds=int(rest_seconds))

    return None


def sets_json_to_planned_timeline(
    sets_json: Sequence[SetScheme | Mapping[str, Any]],
) -> list[PlannedSetTimelineEntry]:
    """Собирает planned_sets из фактического лога упражнения."""
    planned: list[PlannedSetTimelineEntry] = []
    for raw in sets_json:
        item = log_entry_to_planned(raw)
        if item is not None:
            planned.append(item)
    return planned


def count_planned_work_sets(timeline: Iterable[PlannedSetTimelineEntry]) -> int:
    """Число запланированных рабочих подходов (для legacy planned_sets_count: int)."""
    return sum(1 for item in timeline if item.type == "set")


def exercise_to_template(
    exercise: Mapping[str, Any] | Any,
    *,
    strip_ids: bool = True,
) -> ExerciseInWorkoutTemplate:
    """Преобразует упражнение с логом в упражнение шаблона."""
    data = _as_mapping(exercise)
    sets_json = data.get("sets_json") or data.get("timeline") or []
    parsed_sets = [_set_adapter.validate_python(item) for item in sets_json]
    planned = sets_json_to_planned_timeline(parsed_sets)
    legacy_count = data.get("planned_sets_count")
    if legacy_count is None:
        legacy_count = data.get("planned_sets")

    return ExerciseInWorkoutTemplate(
        id=None if strip_ids else data.get("id"),
        exercise_in_catalog_id=data.get("exercise_in_catalog_id"),
        workout_id=None if strip_ids else data.get("workout_id"),
        order_index=int(data["order_index"]),
        sets_json=[],
        planned_sets_json=planned,
        planned_sets_count=legacy_count if not planned else None,
        note=data.get("note"),
    )


def _default_repeat_day_title(day_title: Optional[str]) -> Optional[str]:
    if not day_title or not str(day_title).strip():
        return day_title
    title = str(day_title).strip()
    lowered = title.casefold()
    if lowered.startswith("повтор:") or lowered.startswith("повтор "):
        return title
    if lowered.startswith("запланированный "):
        title = title[len("запланированный ") :].strip()
    return f"повтор: {title}"


def workout_to_template(
    workout: Mapping[str, Any] | Any,
    *,
    workout_date: Optional[date] = None,
    day_title: Optional[str] = None,
    strip_ids: bool = True,
    clear_created_at: bool = True,
    default_workout_date_offset_days: int = 1,
) -> WorkoutTemplate:
    """
    Преобразует выполненную тренировку в шаблон.

    - sets_json у всех упражнений очищается;
    - planned_sets_json заполняется из фактических set/rest записей;
    - mark/comment из лога не переносятся.
    """
    data = _as_mapping(workout)
    exercises_raw = data.get("exercises") or data.get("timeline") or []

    source_date = data.get("workout_date")
    if isinstance(source_date, str):
        source_date = date.fromisoformat(source_date)
    if workout_date is None and source_date is not None:
        workout_date = source_date + timedelta(days=default_workout_date_offset_days)
    if workout_date is None:
        raise ValueError(
            "workout_date не задан и не удалось вывести из исходной тренировки"
        )

    resolved_title = day_title
    if resolved_title is None:
        resolved_title = _default_repeat_day_title(data.get("day_title"))

    template_exercises = [
        exercise_to_template(ex, strip_ids=strip_ids) for ex in exercises_raw
    ]
    template_exercises.sort(key=lambda ex: ex.order_index)

    return WorkoutTemplate(
        id=None if strip_ids else data.get("id"),
        user_id=data.get("user_id"),
        created_at=None if clear_created_at else data.get("created_at"),
        workout_date=workout_date,
        day_title=resolved_title,
        note=data.get("note"),
        user_gym_id=data.get("user_gym_id"),
        user_gym=data.get("user_gym"),
        exercises=template_exercises,
    )


def planned_sets_json_to_db(
    planned: Sequence[PlannedSetTimelineEntry | Mapping[str, Any]],
) -> list[dict]:
    """Сериализует planned_sets_json для записи в JSONB колонку."""
    out: list[dict] = []
    for item in planned:
        if hasattr(item, "model_dump"):
            out.append(item.model_dump(mode="json", exclude_none=True))
        else:
            out.append(dict(item))
    return out


def workout_template_to_create_payload(template: WorkoutTemplate) -> dict[str, Any]:
    """
    Сериализует шаблон в dict для POST /workouts (без id и created_at).

    Если planned_sets_json непустой — planned_sets_count не отправляется.
    """
    payload = template.model_dump(mode="json", exclude_none=True)
    payload.pop("id", None)
    payload.pop("created_at", None)
    payload.pop("user_gym", None)
    for exercise in payload.get("exercises", []):
        exercise.pop("id", None)
        exercise.pop("workout_id", None)
        planned_json = exercise.get("planned_sets_json") or []
        if planned_json:
            exercise.pop("planned_sets_count", None)
        else:
            exercise.pop("planned_sets_json", None)
            exercise.pop("planned_sets", None)
    return payload
