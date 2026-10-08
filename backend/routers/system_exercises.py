"""Системные (предустановленные) упражнения — просмотр и копирование в каталог."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from db.models.postgres import User
from dependencies.admin import require_admin
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.exercise_in_catalog import ExerciseInCatalogCreateResponse
from schemas.exercise_library import (
    SystemExerciseAdminCreate,
    SystemExerciseAdminPatch,
    SystemExerciseOut,
)
from services.postgres.system_exercise_actions import (
    admin_create_system_exercise,
    admin_delete_system_exercise,
    admin_patch_system_exercise,
    copy_system_exercise_to_catalog,
    get_system_exercise,
    list_system_exercises,
)

router = APIRouter(prefix="/system-exercises", tags=["system_exercises"])


@router.get("/", response_model=list[SystemExerciseOut])
async def list_system(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    muscle_group: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(description="Поиск по названию")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Список активных системных упражнений."""
    _ = auth_user
    return await list_system_exercises(
        session, muscle_group=muscle_group, q=q, limit=limit, offset=offset
    )


@router.get("/{item_id}", response_model=SystemExerciseOut)
async def get_system(
    item_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    _ = auth_user
    return await get_system_exercise(session, item_id)


@router.post(
    "/{item_id}/copy-to-catalog", response_model=ExerciseInCatalogCreateResponse
)
async def copy_system_to_catalog(
    item_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Скопировать системное упражнение в личный каталог (дубликат)."""
    return await copy_system_exercise_to_catalog(session, item_id, auth_user)


@router.post("/admin", response_model=SystemExerciseOut)
async def admin_create(
    data: SystemExerciseAdminCreate,
    session: db_session,
    _: Annotated[User, Depends(require_admin)],
):
    return await admin_create_system_exercise(session, data)


@router.patch("/admin/{item_id}", response_model=SystemExerciseOut)
async def admin_patch(
    item_id: Annotated[int, Path(ge=1)],
    data: SystemExerciseAdminPatch,
    session: db_session,
    _: Annotated[User, Depends(require_admin)],
):
    return await admin_patch_system_exercise(session, item_id, data)


@router.delete("/admin/{item_id}")
async def admin_deactivate(
    item_id: Annotated[int, Path(ge=1)],
    session: db_session,
    _: Annotated[User, Depends(require_admin)],
):
    return await admin_delete_system_exercise(session, item_id)
