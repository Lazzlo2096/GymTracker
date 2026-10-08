"""Системные (предустановленные) упражнения — CRUD админа и копирование в каталог."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import SystemExercise, User as PgUser
from schemas.exercise_library import SystemExerciseAdminCreate, SystemExerciseAdminPatch
from services.postgres.catalog_copy import (
    catalog_row_to_create_response,
    copy_fields_to_user_catalog,
)
from utils.db_errors import rollback_and_raise_integrity


def _system_to_dict(row: SystemExercise) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "notes": row.notes,
        "muscle_group": row.muscle_group,
        "machine_location": row.machine_location,
        "machine_settings": row.machine_settings,
        "icon": row.icon,
        "image": row.image,
        "sort_order": row.sort_order,
        "is_active": row.is_active,
        "created_at": row.created_at,
    }


async def list_system_exercises(
    session: AsyncSession,
    *,
    muscle_group: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
    include_inactive: bool = False,
) -> list[dict]:
    stmt = select(SystemExercise).order_by(
        SystemExercise.sort_order.asc(), SystemExercise.name.asc()
    )
    if not include_inactive:
        stmt = stmt.where(SystemExercise.is_active.is_(True))
    if muscle_group:
        stmt = stmt.where(SystemExercise.muscle_group == muscle_group)
    if q:
        stmt = stmt.where(SystemExercise.name.ilike(f"%{q}%"))
    stmt = stmt.limit(limit).offset(offset)
    rows = (await session.scalars(stmt)).all()
    return [_system_to_dict(r) for r in rows]


async def get_system_exercise(session: AsyncSession, item_id: int) -> dict:
    row = await session.get(SystemExercise, item_id)
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="Not found")
    return _system_to_dict(row)


async def copy_system_exercise_to_catalog(
    session: AsyncSession, system_id: int, auth_user: PgUser
) -> dict:
    row = await session.get(SystemExercise, system_id)
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="Not found")
    catalog_row = await copy_fields_to_user_catalog(
        session,
        auth_user.id,
        name=row.name,
        notes=row.notes,
        muscle_group=row.muscle_group,
        machine_location=row.machine_location,
        machine_settings=row.machine_settings,
        icon=row.icon,
        image=row.image,
        source_system_exercise_id=row.id,
    )
    return catalog_row_to_create_response(catalog_row)


async def admin_create_system_exercise(
    session: AsyncSession, data: SystemExerciseAdminCreate
) -> dict:
    row = SystemExercise(**data.model_dump())
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Exercise name already exists",
            other_detail="Could not save exercise",
        )
    await session.refresh(row)
    return _system_to_dict(row)


async def admin_patch_system_exercise(
    session: AsyncSession, item_id: int, data: SystemExerciseAdminPatch
) -> dict:
    row = await session.get(SystemExercise, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    patch = data.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(row, k, v)
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Exercise name already exists",
            other_detail="Could not save exercise",
        )
    await session.refresh(row)
    return _system_to_dict(row)


async def admin_delete_system_exercise(session: AsyncSession, item_id: int) -> dict:
    row = await session.get(SystemExercise, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    row.is_active = False
    await session.commit()
    return {"status": "deactivated"}
