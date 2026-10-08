"""CRUD сценарии exercises_in_workout для PostgreSQL."""

from __future__ import annotations

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import asc, desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import ExerciseInWorkout, Workout
from db.models.postgres.user import User as PgUser
from db.repositories.postgres.exercise_in_workout_repository import (
    get_exercise_in_workout,
)
from db.repositories.postgres.workout_repository import (
    get_exercise_in_catalog,
    get_workout,
    lock_workout_row,
)
from schemas.exercise_in_workout import (
    ExerciseInWorkoutCreate,
    ExerciseInWorkoutPatch,
    ExerciseInWorkoutReplace,
)
from services.postgres.catalog_access import resolve_catalog_scope_user_ids
from services.postgres.workout_actions import can_access_workout_owner
from utils.cache import invalidate_workouts_cache_scoped
from utils.db_errors import rollback_and_raise_integrity


async def _lock_workout_orders(session: AsyncSession, *workout_ids: int) -> None:
    """Блокирует тренировки в порядке id, чтобы смена order_index не зациклила ожидание."""
    for workout_id in sorted(set(workout_ids)):
        await lock_workout_row(session, workout_id)


_ORDER_CONFLICT = "Exercise with this order already exists in the workout"
_ORDER_OTHER = "Could not save exercise in workout"


def _serialize_sets_json(sets: list, *, exclude_none: bool = True) -> list[dict]:
    """
    Приводит элементы sets_json к JSON-совместимому виду.
    Нужен для полей datetime внутри SetScheme (например, "datetime").
    """
    return [jsonable_encoder(item, exclude_none=exclude_none) for item in sets]


def _exercise_in_workout_to_dict(
    row: ExerciseInWorkout,
    *,
    user_id: int,
    message: str | None = None,
) -> dict:
    out = {
        "id": row.id,
        "user_id": user_id,
        "workout_id": row.workout_id,
        "exercise_in_catalog_id": row.exercise_in_catalog_id,
        "order_index": row.order_index,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "sets_json": list(row.sets_json or []),
        "planned_sets_json": list(row.planned_sets_json or []),
        "planned_sets_count": row.planned_sets,
        "note": row.note,
        "created_at": row.created_at,
    }

    if message is not None:
        out["message"] = message

    return out


async def _ensure_catalog_belongs_workout_owner(
    session: AsyncSession,
    *,
    exercise_in_catalog_id: int | None,
    workout_owner_id: int,
) -> None:
    if exercise_in_catalog_id is None:
        return
    cat = await get_exercise_in_catalog(session, exercise_in_catalog_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Exercise not found in catalog")

    if cat.user_id != workout_owner_id:
        raise HTTPException(
            status_code=400,
            detail="Упражнение из каталога принадлежит другому пользователю, чем тренировка",
        )


async def _get_authorized_exercise_in_workout(
    session: AsyncSession,
    item_id: int,
    auth_user: PgUser,
) -> tuple[ExerciseInWorkout, Workout]:
    row = await get_exercise_in_workout(session, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="ExerciseInWorkout not found")

    workout = await get_workout(session, row.workout_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    if not await can_access_workout_owner(session, auth_user, workout.user_id):
        raise HTTPException(status_code=404, detail="ExerciseInWorkout not found")

    return row, workout


async def postgres_create_exercise_in_workout(
    session: AsyncSession,
    data: ExerciseInWorkoutCreate,
    auth_user: PgUser,
) -> dict:
    workout = await get_workout(session, data.workout_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    if not await can_access_workout_owner(session, auth_user, workout.user_id):
        raise HTTPException(status_code=404, detail="Workout not found")

    await _ensure_catalog_belongs_workout_owner(
        session,
        exercise_in_catalog_id=data.exercise_in_catalog_id,
        workout_owner_id=workout.user_id,
    )

    await _lock_workout_orders(session, data.workout_id)

    row = ExerciseInWorkout(
        workout_id=data.workout_id,
        exercise_in_catalog_id=data.exercise_in_catalog_id,
        order_index=data.order_index,
        start_time=data.start_time,
        end_time=data.end_time,
        sets_json=_serialize_sets_json(data.sets_json),
        note=data.note,
    )
    session.add(row)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail=_ORDER_CONFLICT,
            other_detail=_ORDER_OTHER,
        )
    await session.refresh(row)
    await invalidate_workouts_cache_scoped(
        session, workout.user_id, also_invalidate=(auth_user.id,)
    )

    return _exercise_in_workout_to_dict(
        row, user_id=workout.user_id, message="Exercise in workout created"
    )


async def postgres_list_exercises_in_workout(
    session: AsyncSession,
    auth_user: PgUser,
    *,
    owner: str | None = None,
    workout_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    sort: str = "order_index",
    order: str = "asc",
) -> list[dict]:
    scope_user_ids = await resolve_catalog_scope_user_ids(session, auth_user, owner)

    stmt = select(ExerciseInWorkout, Workout.user_id).join(
        Workout, Workout.id == ExerciseInWorkout.workout_id
    )

    if scope_user_ids is not None:
        if len(scope_user_ids) == 1:
            stmt = stmt.where(Workout.user_id == scope_user_ids[0])
        else:
            stmt = stmt.where(Workout.user_id.in_(scope_user_ids))

    if workout_id is not None:
        workout = await get_workout(session, workout_id)

        if not workout or not await can_access_workout_owner(
            session, auth_user, workout.user_id
        ):
            raise HTTPException(status_code=404, detail="Workout not found")
        stmt = stmt.where(ExerciseInWorkout.workout_id == workout_id)

    sort_col = (
        ExerciseInWorkout.order_index
        if sort == "order_index"
        else ExerciseInWorkout.created_at
    )
    sort_expr = desc(sort_col) if order.lower() == "desc" else asc(sort_col)
    stmt = (
        stmt.order_by(sort_expr, desc(ExerciseInWorkout.id)).limit(limit).offset(offset)
    )

    rows = (await session.execute(stmt)).all()

    return [_exercise_in_workout_to_dict(row, user_id=user_id) for row, user_id in rows]


async def postgres_get_exercise_in_workout(
    session: AsyncSession,
    item_id: int,
    auth_user: PgUser,
) -> dict:
    row, workout = await _get_authorized_exercise_in_workout(
        session, item_id, auth_user
    )
    return _exercise_in_workout_to_dict(row, user_id=workout.user_id)


async def postgres_replace_exercise_in_workout(
    session: AsyncSession,
    item_id: int,
    data: ExerciseInWorkoutReplace,
    auth_user: PgUser,
) -> dict:
    row, source_workout = await _get_authorized_exercise_in_workout(
        session, item_id, auth_user
    )

    target_workout = await get_workout(session, data.workout_id)
    if not target_workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    if not await can_access_workout_owner(session, auth_user, target_workout.user_id):
        raise HTTPException(status_code=404, detail="Workout not found")

    await _ensure_catalog_belongs_workout_owner(
        session,
        exercise_in_catalog_id=data.exercise_in_catalog_id,
        workout_owner_id=target_workout.user_id,
    )

    await _lock_workout_orders(session, row.workout_id, data.workout_id)

    row.workout_id = data.workout_id
    row.exercise_in_catalog_id = data.exercise_in_catalog_id
    row.order_index = data.order_index
    row.start_time = data.start_time
    row.end_time = data.end_time
    row.sets_json = _serialize_sets_json(data.sets_json)
    row.note = data.note

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail=_ORDER_CONFLICT,
            other_detail=_ORDER_OTHER,
        )
    await invalidate_workouts_cache_scoped(
        session,
        source_workout.user_id,
        target_workout.user_id,
        also_invalidate=(auth_user.id,),
    )
    return {"status": "updated"}


async def postgres_patch_exercise_in_workout(
    session: AsyncSession,
    item_id: int,
    data: ExerciseInWorkoutPatch,
    auth_user: PgUser,
) -> dict:
    row, workout = await _get_authorized_exercise_in_workout(
        session, item_id, auth_user
    )
    patch = data.model_dump(exclude_unset=True)
    if not patch:
        await invalidate_workouts_cache_scoped(
            session, workout.user_id, also_invalidate=(auth_user.id,)
        )
        return {"status": "updated"}

    workout_owner_id = workout.user_id
    if "workout_id" in patch:
        new_workout = await get_workout(session, patch["workout_id"])
        if not new_workout:
            raise HTTPException(status_code=404, detail="Workout not found")

        if not await can_access_workout_owner(session, auth_user, new_workout.user_id):
            raise HTTPException(status_code=404, detail="Workout not found")
        workout_owner_id = new_workout.user_id

    if "exercise_in_catalog_id" in patch:
        await _ensure_catalog_belongs_workout_owner(
            session,
            exercise_in_catalog_id=patch["exercise_in_catalog_id"],
            workout_owner_id=workout_owner_id,
        )

    if "order_index" in patch or "workout_id" in patch:
        lock_ids = [row.workout_id]
        if "workout_id" in patch:
            lock_ids.append(int(patch["workout_id"]))
        await _lock_workout_orders(session, *lock_ids)

    for key in (
        "workout_id",
        "exercise_in_catalog_id",
        "order_index",
        "start_time",
        "end_time",
        "note",
    ):
        if key in patch:
            setattr(row, key, patch[key])

    if "planned_sets_count" in patch:
        row.planned_sets = patch.pop("planned_sets_count")
    elif "planned_sets" in patch:
        row.planned_sets = patch.pop("planned_sets")

    if "planned_sets_json" in patch:
        row.planned_sets_json = list(patch.pop("planned_sets_json") or [])

    if "sets_json" in patch:
        row.sets_json = _serialize_sets_json(patch["sets_json"], exclude_none=False)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail=_ORDER_CONFLICT,
            other_detail=_ORDER_OTHER,
        )
    owner_ids = [workout.user_id]
    if "workout_id" in patch:
        owner_ids.append(workout_owner_id)
    await invalidate_workouts_cache_scoped(
        session, *owner_ids, also_invalidate=(auth_user.id,)
    )
    return {"status": "updated"}


async def postgres_delete_exercise_in_workout(
    session: AsyncSession,
    item_id: int,
    auth_user: PgUser,
) -> dict:
    row, workout = await _get_authorized_exercise_in_workout(
        session, item_id, auth_user
    )

    await session.delete(row)
    await session.commit()
    await invalidate_workouts_cache_scoped(
        session, workout.user_id, also_invalidate=(auth_user.id,)
    )

    return {"status": "deleted"}
