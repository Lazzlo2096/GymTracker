"""Exercise-in-workout set management endpoints."""

from typing import Annotated, List

from fastapi import APIRouter, Depends

from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
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
from cache_groups import CacheGroup, mark_cache_group
from services.postgres.exercise_in_workout_set_actions import (
    postgres_add_set,
    postgres_add_planned_set,
    postgres_delete_set,
    postgres_delete_planned_set,
    postgres_update_planned_sets,
    postgres_update_planned_set,
    postgres_update_set,
    postgres_update_sets,
)

router = APIRouter(prefix="/exercises_in_workout", tags=["exercises_in_workout/set"])


@router.post("/{exercise_in_workout_id}/set", response_model=AddSetResponse)
@mark_cache_group(CacheGroup.HOT0)
async def add_set(
    exercise_in_workout_id: int,
    set_data: SetData,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Add a new set/log entry to an exercise in workout."""
    return await postgres_add_set(session, exercise_in_workout_id, set_data, auth_user)


@router.put("/{exercise_in_workout_id}/set/{set_idx}", response_model=UpdateSetResponse)
@mark_cache_group(CacheGroup.HOT0)
async def update_set(
    exercise_in_workout_id: int,
    set_idx: int,
    updated_data: SetUpdate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Update a set at the given index by merging updated_data."""
    return await postgres_update_set(
        session,
        exercise_in_workout_id,
        set_idx,
        updated_data,
        auth_user,
    )


@router.put("/{exercise_in_workout_id}/set", response_model=UpdateSetsResponse)
@mark_cache_group(CacheGroup.HOT0)
async def update_sets(
    exercise_in_workout_id: int,
    updated_data: List[SetData],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Replace the entire sets array for an exercise in workout."""
    return await postgres_update_sets(
        session, exercise_in_workout_id, updated_data, auth_user
    )


@router.post(
    "/{exercise_in_workout_id}/planned_set", response_model=AddPlannedSetResponse
)
@mark_cache_group(CacheGroup.HOT0)
async def add_planned_set(
    exercise_in_workout_id: int,
    set_data: SetData,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Add a new entry to planned_sets_json."""
    return await postgres_add_planned_set(
        session, exercise_in_workout_id, set_data, auth_user
    )


@router.put(
    "/{exercise_in_workout_id}/planned_set/{set_idx}",
    response_model=UpdatePlannedSetResponse,
)
@mark_cache_group(CacheGroup.HOT0)
async def update_planned_set(
    exercise_in_workout_id: int,
    set_idx: int,
    updated_data: SetUpdate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Update a planned_sets_json entry at the given index."""
    return await postgres_update_planned_set(
        session,
        exercise_in_workout_id,
        set_idx,
        updated_data,
        auth_user,
    )


@router.delete(
    "/{exercise_in_workout_id}/planned_set/{set_idx}",
    response_model=DeletePlannedSetResponse,
)
@mark_cache_group(CacheGroup.HOT0)
async def delete_planned_set(
    exercise_in_workout_id: int,
    set_idx: int,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Remove a planned_sets_json entry at the given index."""
    return await postgres_delete_planned_set(
        session, exercise_in_workout_id, set_idx, auth_user
    )


@router.patch(
    "/{exercise_in_workout_id}/planned_sets", response_model=PlannedSetsResponse
)
@mark_cache_group(CacheGroup.HOT0)
async def update_planned_sets(
    exercise_in_workout_id: int,
    body: PlannedSetsUpdate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Установить или обновить запланированное количество подходов."""
    return await postgres_update_planned_sets(
        session, exercise_in_workout_id, body, auth_user
    )


@router.delete(
    "/{exercise_in_workout_id}/set/{set_idx}", response_model=DeleteSetResponse
)
@mark_cache_group(CacheGroup.HOT0)
async def delete_set(
    exercise_in_workout_id: int,
    set_idx: int,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Remove a set at the given index."""
    return await postgres_delete_set(
        session, exercise_in_workout_id, set_idx, auth_user
    )
