"""Генерация календарных слотов расписания из program_json (без БД)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from schemas.plans import (
    PlannedSessionOut,
    ProgramCyclePatternOut,
    ProgramOut,
    ProgramSequenceOut,
    ProgramWeekFixedOut,
    ProgramWeeklyQuotaOut,
)

SCHEDULE_HORIZON_DAYS = 28

SlotKind = Literal["workout", "rest"]


@dataclass(frozen=True)
class ScheduledSlot:
    """Один запланированный слот: дата + шаблон (или без шаблона)."""

    session_date: date
    template_id: int | None


@dataclass(frozen=True)
class TemplateSnapshot:
    """Метаданные шаблона для карточки расписания."""

    title: str
    gym_name: str | None
    exercises_count: int
    estimated_minutes: int


def iter_horizon_dates(
    start: date, horizon_days: int = SCHEDULE_HORIZON_DAYS
) -> list[date]:
    return [start + timedelta(days=offset) for offset in range(horizon_days)]


def collect_program_template_ids(program: ProgramOut) -> set[int]:
    """Собрать id шаблонов, на которые ссылается программа."""
    ids: set[int] = set()
    if program.schedule_type == "cycle_pattern":
        ids.update(program.templates)
    elif program.schedule_type == "weekly_quota":
        ids.update(program.rotation)
    else:
        for day in program.days:
            if day.template_id is not None:
                ids.add(day.template_id)
    return ids


def materialize_cycle_pattern_slots(
    program: ProgramCyclePatternOut,
) -> list[tuple[SlotKind, int | None]]:
    """Развернуть cycle_pattern в циклическую последовательность слотов."""
    slots: list[tuple[SlotKind, int | None]] = []
    template_index = 0
    for _ in range(program.pattern.work):
        template_id = program.templates[template_index % len(program.templates)]
        slots.append(("workout", template_id))
        template_index += 1
    for _ in range(program.pattern.rest):
        slots.append(("rest", None))
    return slots


def distribute_quota_weekdays(sessions_per_week: int) -> list[int]:
    """Равномерно распределить N тренировок по ISO-дням недели (1–7)."""
    if sessions_per_week <= 0:
        return []
    if sessions_per_week >= 7:
        return list(range(1, 8))
    weekdays: list[int] = []
    for index in range(sessions_per_week):
        position = (index + 0.5) * 7 / sessions_per_week
        weekday = min(7, max(1, int(position) + 1))
        weekdays.append(weekday)
    return weekdays


def generate_week_fixed_slots(
    program: ProgramWeekFixedOut,
    *,
    start: date,
    horizon_days: int = SCHEDULE_HORIZON_DAYS,
) -> list[ScheduledSlot]:
    weekday_templates: dict[int, int] = {}
    for day in program.days:
        if (
            day.kind == "workout"
            and day.enabled
            and day.iso_weekday is not None
            and day.template_id is not None
        ):
            weekday_templates[day.iso_weekday] = day.template_id

    slots: list[ScheduledSlot] = []
    for session_date in iter_horizon_dates(start, horizon_days):
        template_id = weekday_templates.get(session_date.isoweekday())
        if template_id is not None:
            slots.append(ScheduledSlot(session_date, template_id))
    return slots


def _sequence_start_index(program: ProgramSequenceOut) -> int | None:
    for index, day in enumerate(program.days):
        if day.state == "next":
            return index
    for index, day in enumerate(program.days):
        if day.kind == "workout" and day.enabled:
            return index
    return None


def generate_sequence_slots(
    program: ProgramSequenceOut,
    *,
    start: date,
    horizon_days: int = SCHEDULE_HORIZON_DAYS,
) -> list[ScheduledSlot]:
    if not program.days:
        return []

    start_index = _sequence_start_index(program)
    if start_index is None:
        return []

    slots: list[ScheduledSlot] = []
    slot_index = start_index
    session_date = start
    end = start + timedelta(days=horizon_days - 1)

    while session_date <= end:
        day = program.days[slot_index % len(program.days)]
        if day.kind == "workout" and day.enabled:
            slots.append(ScheduledSlot(session_date, day.template_id))
        slot_index += 1
        session_date += timedelta(days=1)

    return slots


def generate_cycle_pattern_slots(
    program: ProgramCyclePatternOut,
    *,
    start: date,
    horizon_days: int = SCHEDULE_HORIZON_DAYS,
) -> list[ScheduledSlot]:
    cycle = materialize_cycle_pattern_slots(program)
    if not cycle:
        return []

    slots: list[ScheduledSlot] = []
    slot_index = 0
    session_date = start
    end = start + timedelta(days=horizon_days - 1)

    while session_date <= end:
        kind, template_id = cycle[slot_index % len(cycle)]
        if kind == "workout":
            slots.append(ScheduledSlot(session_date, template_id))
        slot_index += 1
        session_date += timedelta(days=1)

    return slots


def generate_weekly_quota_slots(
    program: ProgramWeeklyQuotaOut,
    *,
    start: date,
    horizon_days: int = SCHEDULE_HORIZON_DAYS,
) -> list[ScheduledSlot]:
    quota_weekdays = set(distribute_quota_weekdays(program.sessions_per_week))
    if not quota_weekdays:
        return []

    slots: list[ScheduledSlot] = []
    rotation_index = 0
    for session_date in iter_horizon_dates(start, horizon_days):
        if session_date.isoweekday() not in quota_weekdays:
            continue
        template_id = program.rotation[rotation_index % len(program.rotation)]
        slots.append(ScheduledSlot(session_date, template_id))
        rotation_index += 1

    return slots


def generate_scheduled_slots(
    program: ProgramOut,
    *,
    start: date,
    horizon_days: int = SCHEDULE_HORIZON_DAYS,
) -> list[ScheduledSlot]:
    """Построить слоты расписания по типу программы."""
    if program.schedule_type == "week_fixed":
        return generate_week_fixed_slots(
            program, start=start, horizon_days=horizon_days
        )
    if program.schedule_type == "sequence":
        return generate_sequence_slots(program, start=start, horizon_days=horizon_days)
    if program.schedule_type == "cycle_pattern":
        return generate_cycle_pattern_slots(
            program, start=start, horizon_days=horizon_days
        )
    return generate_weekly_quota_slots(program, start=start, horizon_days=horizon_days)


def planned_session_status(
    template_id: int | None,
    template: TemplateSnapshot | None,
) -> Literal["plan_ready", "draft"]:
    if template_id is None or template is None:
        return "draft"
    if template.exercises_count > 0:
        return "plan_ready"
    return "draft"


def slot_to_planned_session(
    slot: ScheduledSlot,
    templates: dict[int, TemplateSnapshot],
) -> PlannedSessionOut:
    template = templates.get(slot.template_id) if slot.template_id is not None else None
    status = planned_session_status(slot.template_id, template)

    if template is not None:
        title = template.title
        gym_name = template.gym_name
        exercises_count = template.exercises_count
        estimated_minutes = template.estimated_minutes
    else:
        title = "Тренировка"
        gym_name = None
        exercises_count = 0
        estimated_minutes = 0

    return PlannedSessionOut(
        date=slot.session_date,
        title=title,
        gym_name=gym_name,
        exercises_count=exercises_count,
        estimated_minutes=estimated_minutes,
        status=status,
        source="from_template" if slot.template_id is not None else None,
    )


def build_planned_sessions(
    program: ProgramOut,
    templates: dict[int, TemplateSnapshot],
    *,
    start: date,
    horizon_days: int = SCHEDULE_HORIZON_DAYS,
) -> list[PlannedSessionOut]:
    """Собрать ответ API из программы и метаданных шаблонов."""
    slots = generate_scheduled_slots(program, start=start, horizon_days=horizon_days)
    sessions = [slot_to_planned_session(slot, templates) for slot in slots]
    sessions.sort(key=lambda item: item.date)
    return sessions
