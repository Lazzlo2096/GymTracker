"""Запланированные сессии для вкладки «Расписание» (/plans)."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.postgres.training_program import TrainingProgram
from db.models.postgres.user import User as PgUser
from db.models.postgres.workout_template import WorkoutTemplate
from schemas.plans import (
    PlannedSessionOut,
    normalize_legacy_program_json,
    program_out_adapter,
)
from services.planned_sessions_schedule import (
    SCHEDULE_HORIZON_DAYS,
    TemplateSnapshot,
    build_planned_sessions,
    collect_program_template_ids,
)


async def _load_current_program_row(
    session: AsyncSession,
    user_id: int,
) -> TrainingProgram | None:
    result = await session.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == user_id,
            TrainingProgram.is_current.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def _load_template_snapshots(
    session: AsyncSession,
    user_id: int,
    template_ids: set[int],
) -> dict[int, TemplateSnapshot]:
    if not template_ids:
        return {}

    result = await session.execute(
        select(WorkoutTemplate)
        .where(
            WorkoutTemplate.user_id == user_id,
            WorkoutTemplate.id.in_(template_ids),
        )
        .options(
            selectinload(WorkoutTemplate.user_gym),
            selectinload(WorkoutTemplate.exercises),
        )
    )
    rows = result.scalars().all()

    snapshots: dict[int, TemplateSnapshot] = {}
    for row in rows:
        gym_name = row.user_gym.name if row.user_gym is not None else None
        estimated = row.estimated_minutes if row.estimated_minutes is not None else 0
        snapshots[row.id] = TemplateSnapshot(
            title=row.title,
            gym_name=gym_name,
            exercises_count=len(row.exercises),
            estimated_minutes=estimated,
        )
    return snapshots


async def postgres_list_planned_sessions(
    session: AsyncSession,
    auth_user: PgUser,
    *,
    start: date | None = None,
    horizon_days: int = SCHEDULE_HORIZON_DAYS,
) -> list[PlannedSessionOut]:
    """
    Запланированные тренировки из текущей программы пользователя.

    Если текущая программа не выбрана — пустой список (не 404).
    """
    row = await _load_current_program_row(session, auth_user.id)
    if row is None:
        return []

    payload = normalize_legacy_program_json(dict(row.program_json))
    payload["id"] = row.id
    program = program_out_adapter.validate_python(payload)

    template_ids = collect_program_template_ids(program)
    templates = await _load_template_snapshots(session, auth_user.id, template_ids)

    today = start if start is not None else date.today()
    return build_planned_sessions(
        program,
        templates,
        start=today,
        horizon_days=horizon_days,
    )
