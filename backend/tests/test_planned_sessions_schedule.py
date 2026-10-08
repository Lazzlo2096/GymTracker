"""Юнит-тесты генерации расписания из program_json."""

from __future__ import annotations

from datetime import date

from schemas.plans import (
    ProgramCyclePatternSpec,
    ProgramCyclePatternOut,
    ProgramDaySequence,
    ProgramDayWeekFixed,
    ProgramSequenceOut,
    ProgramWeekFixedOut,
    ProgramWeeklyQuotaOut,
)
from services.planned_sessions_schedule import (
    TemplateSnapshot,
    build_planned_sessions,
    distribute_quota_weekdays,
    generate_cycle_pattern_slots,
    generate_scheduled_slots,
    generate_sequence_slots,
    generate_week_fixed_slots,
    generate_weekly_quota_slots,
    slot_to_planned_session,
)


def _week_fixed_program() -> ProgramWeekFixedOut:
    return ProgramWeekFixedOut(
        id=1,
        name="PPL",
        days=[
            ProgramDayWeekFixed(
                slot=1,
                kind="workout",
                iso_weekday=1,
                template_id=10,
                enabled=True,
            ),
            ProgramDayWeekFixed(
                slot=3,
                kind="workout",
                iso_weekday=3,
                template_id=20,
                enabled=True,
            ),
            ProgramDayWeekFixed(
                slot=5,
                kind="workout",
                iso_weekday=5,
                template_id=30,
                enabled=False,
            ),
        ],
    )


def test_week_fixed_emits_matching_iso_weekdays() -> None:
    # 2026-06-16 — вторник; первая среда в горизонте — 2026-06-17
    start = date(2026, 6, 16)
    slots = generate_week_fixed_slots(
        _week_fixed_program(), start=start, horizon_days=14
    )
    dates = [slot.session_date for slot in slots]
    assert date(2026, 6, 17) in dates  # ср
    assert date(2026, 6, 22) in dates  # пн
    assert all(slot.session_date.isoweekday() in (1, 3) for slot in slots)
    assert slots[0].session_date == date(2026, 6, 17)
    assert slots[0].template_id == 20


def test_sequence_starts_at_next_slot() -> None:
    program = ProgramSequenceOut(
        id=2,
        name="Seq",
        days=[
            ProgramDaySequence(
                slot=1,
                kind="workout",
                template_id=1,
                enabled=True,
                state="done",
            ),
            ProgramDaySequence(
                slot=2,
                kind="rest",
                template_id=None,
                enabled=False,
                state=None,
            ),
            ProgramDaySequence(
                slot=3,
                kind="workout",
                template_id=2,
                enabled=True,
                state="next",
            ),
        ],
    )
    start = date(2026, 6, 16)
    slots = generate_sequence_slots(program, start=start, horizon_days=5)
    assert len(slots) == 4
    assert slots[0].session_date == date(2026, 6, 16)
    assert slots[0].template_id == 2
    assert slots[1].session_date == date(2026, 6, 17)
    assert slots[1].template_id == 1
    assert slots[2].session_date == date(2026, 6, 19)
    assert slots[2].template_id == 2


def test_cycle_pattern_work_rest_rotation() -> None:
    program = ProgramCyclePatternOut(
        id=3,
        name="Cycle",
        pattern=ProgramCyclePatternSpec(work=2, rest=1),
        templates=[100, 200],
    )
    start = date(2026, 6, 16)
    slots = generate_cycle_pattern_slots(program, start=start, horizon_days=6)
    assert [(s.session_date, s.template_id) for s in slots] == [
        (date(2026, 6, 16), 100),
        (date(2026, 6, 17), 200),
        (date(2026, 6, 19), 100),
        (date(2026, 6, 20), 200),
    ]


def test_weekly_quota_distributes_sessions_per_week() -> None:
    assert distribute_quota_weekdays(3) == [2, 4, 6]

    program = ProgramWeeklyQuotaOut(
        id=4,
        name="Quota",
        sessions_per_week=3,
        rotation=[11, 22],
    )
    start = date(2026, 6, 16)  # вт
    slots = generate_weekly_quota_slots(program, start=start, horizon_days=7)
    assert len(slots) == 3
    assert slots[0].session_date == date(2026, 6, 16)
    assert slots[0].template_id == 11
    assert slots[1].session_date == date(2026, 6, 18)
    assert slots[1].template_id == 22
    assert slots[2].session_date == date(2026, 6, 20)
    assert slots[2].template_id == 11


def test_slot_to_planned_session_status_and_source() -> None:
    ready = slot_to_planned_session(
        generate_scheduled_slots(
            _week_fixed_program(),
            start=date(2026, 6, 22),
            horizon_days=1,
        )[0],
        {
            10: TemplateSnapshot(
                title="Ноги",
                gym_name="Iron Gym",
                exercises_count=5,
                estimated_minutes=58,
            )
        },
    )
    assert ready.status == "plan_ready"
    assert ready.source == "from_template"
    assert ready.title == "Ноги"

    draft = slot_to_planned_session(
        generate_scheduled_slots(
            _week_fixed_program(),
            start=date(2026, 6, 22),
            horizon_days=1,
        )[0],
        {},
    )
    assert draft.status == "draft"
    assert draft.exercises_count == 0


def test_build_planned_sessions_sorted_by_date() -> None:
    sessions = build_planned_sessions(
        _week_fixed_program(),
        {
            10: TemplateSnapshot("A", None, 1, 30),
            20: TemplateSnapshot("B", None, 2, 40),
        },
        start=date(2026, 6, 16),
        horizon_days=14,
    )
    assert len(sessions) == 4
    assert sessions[0].date < sessions[1].date
