"""Сценарии exercises_in_workout для PostgreSQL (вызывается из routers.exercise_in_workout_actions)."""

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import User as PgUser
from db.repositories.postgres.exercise_in_workout_repository import (
    get_exercise_in_workout,
)
from db.repositories.postgres.workout_repository import get_workout
from schemas.exercise_in_workout_set import (
    SetData,
    SetUpdate,
    PlannedSetsUpdate,
    AddSetResponse,
    UpdateSetResponse,
    UpdateSetsResponse,
    PlannedSetsResponse,
    DeleteSetResponse,
    AddPlannedSetResponse,
    UpdatePlannedSetResponse,
    DeletePlannedSetResponse,
)
from utils.workout_as_template import log_entry_to_planned
from services.postgres.workout_actions import can_access_workout_owner
from utils.cache import invalidate_workouts_cache_scoped
from services.postgres.promo_actions import process_referral_milestones
from utils.weight_composition import normalize_set_entry_for_storage


def _serialize_set_entry(
    set_entry: SetData | SetUpdate | dict,
    *,
    exclude_none: bool = True,
    exclude_unset: bool = False,
) -> dict:
    """Преобразует запись подхода к JSON-совместимому словарю."""
    if hasattr(set_entry, "model_dump"):
        payload = set_entry.model_dump(
            exclude_none=exclude_none,
            exclude_unset=exclude_unset,
        )
        return jsonable_encoder(payload, exclude_none=exclude_none)
    return jsonable_encoder(set_entry, exclude_none=exclude_none)


async def _get_authorized_workout_exercise(
    session: AsyncSession,
    workout_exercise_id: int,
    auth_user: PgUser,
):
    we = await get_exercise_in_workout(session, workout_exercise_id)
    if not we:
        raise HTTPException(status_code=404, detail="ExerciseInWorkout not found")

    workout = await get_workout(session, we.workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")

    if not await can_access_workout_owner(session, auth_user, workout.user_id):
        raise HTTPException(status_code=404, detail="ExerciseInWorkout not found")

    return we, workout


async def _after_sets_changed(
    session: AsyncSession, workout_exercise_id: int, auth_user: PgUser
) -> None:
    _, workout = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )
    await process_referral_milestones(session, workout.user_id)
    await session.commit()
    await invalidate_workouts_cache_scoped(
        session, workout.user_id, also_invalidate=(auth_user.id,)
    )


async def postgres_add_set(
    session: AsyncSession,
    workout_exercise_id: int,
    set_data: SetData,
    auth_user: PgUser,
) -> AddSetResponse:
    we, workout = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )

    set_dict = _serialize_set_entry(set_data)
    set_dict = await normalize_set_entry_for_storage(session, workout.user_id, set_dict)
    new_sets = [*we.sets_json, set_dict]
    we.sets_json = new_sets

    await session.flush()
    await _after_sets_changed(session, workout_exercise_id, auth_user)
    await session.refresh(we)

    return AddSetResponse(
        message="Set added",
        exercise_in_workout_id=we.id,
        added_set=set_dict,
        all_sets=we.sets_json,
    )


async def postgres_update_set(
    session: AsyncSession,
    workout_exercise_id: int,
    set_idx: int,
    updated_data: SetUpdate,
    auth_user: PgUser,
) -> UpdateSetResponse:
    we, workout = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )
    if set_idx < 0 or set_idx >= len(we.sets_json):
        raise HTTPException(status_code=400, detail="Invalid set_idx")

    merge_dict = _serialize_set_entry(
        updated_data, exclude_none=False, exclude_unset=True
    )
    new_sets = [dict(s) for s in we.sets_json]
    new_sets[set_idx].update(merge_dict)
    new_sets[set_idx] = await normalize_set_entry_for_storage(
        session, workout.user_id, new_sets[set_idx]
    )
    we.sets_json = new_sets

    await session.flush()
    await _after_sets_changed(session, workout_exercise_id, auth_user)
    await session.refresh(we)

    return UpdateSetResponse(
        message="Set updated",
        exercise_in_workout_id=we.id,
        updated_index=set_idx,
        updated_set=we.sets_json[set_idx],
        all_sets=we.sets_json,
    )


async def postgres_update_sets(
    session: AsyncSession,
    workout_exercise_id: int,
    updated_data: list[SetData],
    auth_user: PgUser,
) -> UpdateSetsResponse:
    we, workout = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )

    serialized = [_serialize_set_entry(s) for s in updated_data]
    we.sets_json = [
        await normalize_set_entry_for_storage(session, workout.user_id, entry)
        for entry in serialized
    ]

    await session.flush()
    await _after_sets_changed(session, workout_exercise_id, auth_user)
    await session.refresh(we)

    return UpdateSetsResponse(
        message="Sets updated",
        exercise_in_workout_id=we.id,
        updated_sets=we.sets_json,
    )


async def postgres_update_planned_sets(
    session: AsyncSession,
    workout_exercise_id: int,
    body: PlannedSetsUpdate,
    auth_user: PgUser,
) -> PlannedSetsResponse:
    we, workout = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )
    we.planned_sets = body.planned_sets_count

    await session.commit()
    await session.refresh(we)
    await invalidate_workouts_cache_scoped(
        session, workout.user_id, also_invalidate=(auth_user.id,)
    )

    return PlannedSetsResponse(
        message="Planned sets updated",
        exercise_in_workout_id=we.id,
        planned_sets_count=we.planned_sets,
    )


def _planned_sets_list(we) -> list[dict]:
    return [dict(s) for s in (we.planned_sets_json or [])]


def _serialize_planned_set_entry(set_entry: SetData | SetUpdate | dict) -> dict:
    raw = _serialize_set_entry(set_entry)
    planned = log_entry_to_planned(raw)
    if planned is None:
        raise HTTPException(
            status_code=400,
            detail="Запись не подходит для planned_sets_json (только set/rest)",
        )
    return planned.model_dump(mode="python")


async def postgres_add_planned_set(
    session: AsyncSession,
    workout_exercise_id: int,
    set_data: SetData,
    auth_user: PgUser,
) -> AddPlannedSetResponse:
    we, _ = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )

    set_dict = _serialize_planned_set_entry(set_data)
    new_planned = [*_planned_sets_list(we), set_dict]
    we.planned_sets_json = new_planned

    await session.flush()
    await _after_sets_changed(session, workout_exercise_id, auth_user)
    await session.refresh(we)

    return AddPlannedSetResponse(
        message="Planned set added",
        exercise_in_workout_id=we.id,
        added_set=set_dict,
        all_planned_sets=list(we.planned_sets_json or []),
    )


async def postgres_update_planned_set(
    session: AsyncSession,
    workout_exercise_id: int,
    set_idx: int,
    updated_data: SetUpdate,
    auth_user: PgUser,
) -> UpdatePlannedSetResponse:
    we, _ = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )
    planned = _planned_sets_list(we)
    if set_idx < 0 or set_idx >= len(planned):
        raise HTTPException(status_code=400, detail="Invalid planned_set_idx")

    merge_dict = _serialize_set_entry(
        updated_data, exclude_none=False, exclude_unset=True
    )
    merged = {**planned[set_idx], **merge_dict}
    normalized = _serialize_planned_set_entry(merged)
    new_planned = [*planned]
    new_planned[set_idx] = normalized
    we.planned_sets_json = new_planned

    await session.flush()
    await _after_sets_changed(session, workout_exercise_id, auth_user)
    await session.refresh(we)

    return UpdatePlannedSetResponse(
        message="Planned set updated",
        exercise_in_workout_id=we.id,
        updated_index=set_idx,
        updated_set=we.planned_sets_json[set_idx],
        all_planned_sets=list(we.planned_sets_json or []),
    )


async def postgres_delete_planned_set(
    session: AsyncSession,
    workout_exercise_id: int,
    set_idx: int,
    auth_user: PgUser,
) -> DeletePlannedSetResponse:
    we, _ = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )
    planned = _planned_sets_list(we)
    if set_idx < 0 or set_idx >= len(planned):
        raise HTTPException(status_code=400, detail="Invalid planned_set_idx")

    new_planned = [*planned]
    removed = new_planned.pop(set_idx)
    we.planned_sets_json = new_planned

    await session.flush()
    await _after_sets_changed(session, workout_exercise_id, auth_user)
    await session.refresh(we)

    return DeletePlannedSetResponse(
        message="Planned set deleted",
        exercise_in_workout_id=we.id,
        deleted_index=set_idx,
        deleted_set=removed,
        remaining_planned_sets=list(we.planned_sets_json or []),
    )


async def postgres_delete_set(
    session: AsyncSession,
    workout_exercise_id: int,
    set_idx: int,
    auth_user: PgUser,
) -> DeleteSetResponse:
    we, _ = await _get_authorized_workout_exercise(
        session, workout_exercise_id, auth_user
    )
    if set_idx < 0 or set_idx >= len(we.sets_json):
        raise HTTPException(status_code=400, detail="Invalid set_idx")

    new_sets = [dict(s) for s in we.sets_json]
    removed = new_sets.pop(set_idx)
    we.sets_json = new_sets

    await session.flush()
    await _after_sets_changed(session, workout_exercise_id, auth_user)
    await session.refresh(we)

    return DeleteSetResponse(
        message="Set deleted",
        exercise_in_workout_id=we.id,
        deleted_index=set_idx,
        deleted_set=removed,
        remaining_sets=we.sets_json,
    )
