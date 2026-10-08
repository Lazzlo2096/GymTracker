"""Действия с шаблонами тренировок (PostgreSQL)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from data.mock_workout_templates_loader import load_all_workout_template_seed_items
from db.models.postgres.exercise_in_catalog import ExerciseInCatalog
from db.models.postgres.user import User as PgUser
from db.models.postgres.user_gym import UserGym
from db.models.postgres.workout_template import WorkoutTemplate
from db.models.postgres.workout_template_exercise import WorkoutTemplateExercise
from schemas.workout_template_api import (
    WorkoutTemplateCreate,
    WorkoutTemplateDetailOut,
    WorkoutTemplateExerciseIn,
    WorkoutTemplateExerciseOut,
    WorkoutTemplatePatch,
    WorkoutTemplateSummaryOut,
)
from services.postgres.workout_template_catalog import ensure_catalog_exercise_for_user
from utils.cache import invalidate_workout_templates_cache, invalidate_catalog_cache
from utils.workout_template_planned_sets import (
    compute_planned_tonnage_kg,
    count_work_sets,
    derive_uniform_all_fields,
    planned_sets_api_to_db,
    planned_sets_db_to_api,
)


def _format_last_used_label(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta_days = (now.date() - dt.astimezone(timezone.utc).date()).days
    if delta_days <= 0:
        return "Сегодня"
    if delta_days == 1:
        return "Вчера"
    if delta_days < 5:
        return f"{delta_days} дня назад"
    if delta_days < 21:
        return f"{delta_days} дней назад"
    if delta_days < 35:
        return "Месяц назад"
    return dt.astimezone(timezone.utc).strftime("%d.%m.%Y")


def _exercise_display_name(row: WorkoutTemplateExercise) -> str:
    if row.exercise is not None and (name := (row.exercise.name or "").strip()):
        return name
    if row.title_override and (name := row.title_override.strip()):
        return name
    return "Упражнение"


def _exercise_to_out(row: WorkoutTemplateExercise) -> WorkoutTemplateExerciseOut:
    muscle = row.muscle_group
    if not muscle and row.exercise is not None:
        muscle = row.exercise.muscle_group
    return WorkoutTemplateExerciseOut(
        id=row.id,
        exercise_in_catalog_id=row.exercise_in_catalog_id,
        name=_exercise_display_name(row),
        muscle_group=muscle,
        note=row.note,
        planned_sets_count=row.planned_sets_count,
        planned_tonnage_kg=row.planned_tonnage_kg,
        planned_all_reps=row.planned_all_reps,
        planned_all_weight_kg=row.planned_all_weight_kg,
        planned_all_rest_seconds=row.planned_all_rest_seconds,
        planned_sets=planned_sets_db_to_api(row.planned_sets_json),
    )


def _template_to_summary(row: WorkoutTemplate) -> WorkoutTemplateSummaryOut:
    gym_name = row.user_gym.name if row.user_gym is not None else None
    exercises_count = len(row.exercises)
    estimated = row.estimated_minutes
    if estimated is None:
        estimated = 0
    return WorkoutTemplateSummaryOut(
        id=row.id,
        title=row.title,
        description=row.description,
        gym_name=gym_name,
        exercises_count=exercises_count,
        estimated_minutes=estimated,
        last_used_label=_format_last_used_label(row.last_used_at),
    )


def _template_to_detail(row: WorkoutTemplate) -> WorkoutTemplateDetailOut:
    summary = _template_to_summary(row)
    return WorkoutTemplateDetailOut(
        **summary.model_dump(),
        note=row.note,
        exercises=[_exercise_to_out(ex) for ex in row.exercises],
    )


async def _get_user_gym_or_404(
    session: AsyncSession, user_id: int, gym_id: int | None
) -> UserGym | None:
    if gym_id is None:
        return None
    r = await session.execute(
        select(UserGym).where(UserGym.id == gym_id, UserGym.user_id == user_id)
    )
    gym = r.scalar_one_or_none()
    if gym is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Зал не найден",
        )
    return gym


async def _resolve_gym_id_by_name(
    session: AsyncSession, user_id: int, gym_name: str | None
) -> int | None:
    if not gym_name or not gym_name.strip():
        return None
    name = gym_name.strip()
    r = await session.execute(
        select(UserGym.id).where(
            UserGym.user_id == user_id,
            func.lower(UserGym.name) == name.lower(),
            UserGym.is_archived.is_(False),
        )
    )
    return r.scalar_one_or_none()


def _validate_exercise_in(body: WorkoutTemplateExerciseIn) -> None:
    catalog_id = body.exercise_in_catalog_id
    title = (body.title_override or "").strip()
    if catalog_id is None and not title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Упражнение: нужен exercise_in_catalog_id или title_override",
        )


async def _assert_catalog_exercise_for_user(
    session: AsyncSession,
    user_id: int,
    catalog_id: int,
) -> ExerciseInCatalog:
    row = await session.get(ExerciseInCatalog, catalog_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Упражнение каталога не найдено",
        )
    return row


async def _validate_exercises_in(
    session: AsyncSession,
    user_id: int,
    exercises: list[WorkoutTemplateExerciseIn],
) -> None:
    for body in exercises:
        _validate_exercise_in(body)
        if body.exercise_in_catalog_id is not None:
            await _assert_catalog_exercise_for_user(
                session, user_id, body.exercise_in_catalog_id
            )


def _exercise_in_to_row(
    template_id: int,
    order_index: int,
    body: WorkoutTemplateExerciseIn,
) -> WorkoutTemplateExercise:
    planned_json = planned_sets_api_to_db([s.model_dump() for s in body.planned_sets])
    is_custom = bool(planned_json) and (
        body.planned_all_reps is None
        and body.planned_all_weight_kg is None
        and body.planned_all_rest_seconds is None
    )

    sets_count = body.planned_sets_count
    if sets_count is None and planned_json:
        sets_count = count_work_sets(planned_json)

    tonnage = body.planned_tonnage_kg
    if tonnage is None and planned_json and not is_custom:
        tonnage = compute_planned_tonnage_kg(planned_json)

    if is_custom:
        all_reps = None
        all_weight = None
        all_rest = None
    else:
        all_reps = body.planned_all_reps
        all_weight = body.planned_all_weight_kg
        all_rest = body.planned_all_rest_seconds
        if all_reps is None or all_weight is None or all_rest is None:
            derived_reps, derived_weight, derived_rest = derive_uniform_all_fields(
                planned_json
            )
            if all_reps is None:
                all_reps = derived_reps
            if all_weight is None:
                all_weight = derived_weight
            if all_rest is None:
                all_rest = derived_rest

    catalog_id = body.exercise_in_catalog_id
    title_override = (body.title_override or "").strip() or None
    if catalog_id is not None:
        title_override = None

    muscle_group = (body.muscle_group or "").strip() or None
    if catalog_id is not None:
        muscle_group = None

    return WorkoutTemplateExercise(
        workout_template_id=template_id,
        order_index=order_index,
        exercise_in_catalog_id=catalog_id,
        title_override=title_override,
        muscle_group=muscle_group,
        note=body.note,
        planned_sets_count=sets_count,
        planned_tonnage_kg=tonnage,
        planned_all_reps=all_reps,
        planned_all_weight_kg=all_weight,
        planned_all_rest_seconds=all_rest,
        planned_sets_json=planned_json,
    )


async def _detail_after_write(
    session: AsyncSession,
    user_id: int,
    template_id: int,
    *,
    cache_user_id: int,
) -> WorkoutTemplateDetailOut:
    """Ответ после create/patch: commit, сброс кэша API, свежая загрузка из БД.

    При expire_on_commit=False коллекция exercises на объекте в сессии устаревает
    после delete+insert упражнений — без expire_all() PATCH отдаёт старые данные.
    """
    await session.commit()
    await invalidate_workout_templates_cache(cache_user_id)
    session.expire_all()
    loaded = await _load_template(session, user_id, template_id)
    if loaded is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон не найден",
        )
    return _template_to_detail(loaded)


async def _load_template(
    session: AsyncSession, user_id: int, template_id: int
) -> WorkoutTemplate | None:
    r = await session.execute(
        select(WorkoutTemplate)
        .where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == user_id,
        )
        .options(
            selectinload(WorkoutTemplate.user_gym),
            selectinload(WorkoutTemplate.exercises).selectinload(
                WorkoutTemplateExercise.exercise
            ),
        )
    )
    return r.scalar_one_or_none()


async def _count_templates(session: AsyncSession, user_id: int) -> int:
    r = await session.execute(
        select(func.count())
        .select_from(WorkoutTemplate)
        .where(WorkoutTemplate.user_id == user_id)
    )
    return int(r.scalar_one() or 0)


async def _seed_demo_templates_from_json(session: AsyncSession, user_id: int) -> None:
    """Заполнить демо-шаблоны из workout_templates.json, если у пользователя пусто.
        Usage example:
            if await _count_templates(session, user_id) == 0:
                await _seed_demo_templates_from_json(session, user_id)
    """
    for item in load_all_workout_template_seed_items():
        gym_id = await _resolve_gym_id_by_name(session, user_id, item.get("gym_name"))
        template = WorkoutTemplate(
            user_id=user_id,
            title=str(item.get("title") or "Шаблон"),
            description=item.get("description"),
            note=item.get("note"),
            user_gym_id=gym_id,
            estimated_minutes=item.get("estimated_minutes"),
        )
        session.add(template)
        await session.flush()

        exercises_raw = item.get("exercises")
        if not isinstance(exercises_raw, list):
            continue
        for idx, ex_raw in enumerate(exercises_raw):
            if not isinstance(ex_raw, dict):
                continue
            name = str(ex_raw.get("name") or "").strip()
            if not name:
                continue
            muscle_group = ex_raw.get("muscle_group")
            muscle_str = (
                str(muscle_group).strip() if isinstance(muscle_group, str) else None
            )
            catalog_row = await ensure_catalog_exercise_for_user(
                session,
                user_id,
                name,
                muscle_group=muscle_str,
            )

            planned = ex_raw.get("planned_sets")
            planned_json = (
                planned_sets_api_to_db(planned) if isinstance(planned, list) else []
            )
            all_reps, all_weight, all_rest = derive_uniform_all_fields(planned_json)
            session.add(
                WorkoutTemplateExercise(
                    workout_template_id=template.id,
                    order_index=idx,
                    exercise_in_catalog_id=catalog_row.id,
                    title_override=None,
                    muscle_group=None,
                    note=ex_raw.get("note"),
                    planned_sets_count=count_work_sets(planned_json) or None,
                    planned_tonnage_kg=compute_planned_tonnage_kg(planned_json),
                    planned_all_reps=all_reps,
                    planned_all_weight_kg=all_weight,
                    planned_all_rest_seconds=all_rest,
                    planned_sets_json=planned_json,
                )
            )
    await session.commit()
    await invalidate_catalog_cache(user_id)


async def postgres_list_workout_templates(
    session: AsyncSession, auth_user: PgUser
) -> list[WorkoutTemplateSummaryOut]:

    r = await session.execute(
        select(WorkoutTemplate)
        .where(WorkoutTemplate.user_id == auth_user.id)
        .options(
            selectinload(WorkoutTemplate.user_gym),
            selectinload(WorkoutTemplate.exercises),
        )
        .order_by(WorkoutTemplate.updated_at.desc(), WorkoutTemplate.id.desc())
    )
    rows = r.scalars().all()
    return [_template_to_summary(row) for row in rows]


async def postgres_get_workout_template(
    session: AsyncSession, auth_user: PgUser, template_id: int
) -> WorkoutTemplateDetailOut:

    row = await _load_template(session, auth_user.id, template_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон не найден",
        )
    return _template_to_detail(row)


async def postgres_create_workout_template(
    session: AsyncSession, body: WorkoutTemplateCreate, auth_user: PgUser
) -> WorkoutTemplateDetailOut:
    await _get_user_gym_or_404(session, auth_user.id, body.user_gym_id)
    await _validate_exercises_in(session, auth_user.id, body.exercises)

    row = WorkoutTemplate(
        user_id=auth_user.id,
        title=body.title,
        description=body.description,
        note=body.note,
        user_gym_id=body.user_gym_id,
        estimated_minutes=body.estimated_minutes,
    )
    session.add(row)
    await session.flush()

    for idx, ex in enumerate(body.exercises):
        session.add(_exercise_in_to_row(row.id, idx, ex))

    return await _detail_after_write(
        session, auth_user.id, row.id, cache_user_id=auth_user.id
    )


async def postgres_patch_workout_template(
    session: AsyncSession,
    template_id: int,
    body: WorkoutTemplatePatch,
    auth_user: PgUser,
) -> WorkoutTemplateDetailOut:
    row = await _load_template(session, auth_user.id, template_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон не найден",
        )

    data = body.model_dump(exclude_unset=True)
    exercises_payload = data.pop("exercises", None)

    if "user_gym_id" in data:
        await _get_user_gym_or_404(session, auth_user.id, data["user_gym_id"])

    for field in (
        "title",
        "description",
        "note",
        "user_gym_id",
        "estimated_minutes",
        "last_used_at",
    ):
        if field in data:
            setattr(row, field, data[field])

    if exercises_payload is not None:
        await _validate_exercises_in(session, auth_user.id, body.exercises or [])
        for old in list(row.exercises):
            await session.delete(old)
        await session.flush()
        for idx, ex in enumerate(body.exercises or []):
            session.add(_exercise_in_to_row(row.id, idx, ex))

    row.updated_at = datetime.now(timezone.utc)
    return await _detail_after_write(
        session, auth_user.id, template_id, cache_user_id=auth_user.id
    )


async def postgres_delete_workout_template(
    session: AsyncSession, template_id: int, auth_user: PgUser
) -> None:
    row = await _load_template(session, auth_user.id, template_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон не найден",
        )
    await session.delete(row)
    await session.commit()
    await invalidate_workout_templates_cache(auth_user.id)
