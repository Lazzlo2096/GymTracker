"""Публичные упражнения — просмотр, публикация, копирование в каталог."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import (
    ExerciseInCatalog,
    PublicExercise,
    User as PgUser,
)
from services.postgres.catalog_copy import (
    catalog_row_to_create_response,
    copy_fields_to_user_catalog,
)


def _public_to_dict(row: PublicExercise, *, with_author: bool = False) -> dict:
    out: dict = {
        "id": row.id,
        "author_user_id": row.author_user_id,
        "source_catalog_id": row.source_catalog_id,
        "name": row.name,
        "notes": row.notes,
        "muscle_group": row.muscle_group,
        "machine_location": row.machine_location,
        "machine_settings": row.machine_settings,
        "icon": row.icon,
        "image": row.image,
        "is_active": row.is_active,
        "published_at": row.published_at,
    }
    if with_author and row.author:
        out["author"] = {
            "id": row.author.id,
            "display_name": row.author.display_name,
        }
    return out


async def list_public_exercises(
    session: AsyncSession,
    *,
    muscle_group: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    stmt = (
        select(PublicExercise)
        .where(PublicExercise.is_active.is_(True))
        .order_by(PublicExercise.published_at.desc())
    )
    if muscle_group:
        stmt = stmt.where(PublicExercise.muscle_group == muscle_group)
    if q:
        stmt = stmt.where(PublicExercise.name.ilike(f"%{q}%"))
    stmt = stmt.limit(limit).offset(offset)
    rows = (await session.scalars(stmt)).all()
    return [_public_to_dict(r, with_author=True) for r in rows]


async def list_my_public_exercises(
    session: AsyncSession, auth_user: PgUser
) -> list[dict]:
    stmt = (
        select(PublicExercise)
        .where(PublicExercise.author_user_id == auth_user.id)
        .order_by(PublicExercise.published_at.desc())
    )
    rows = (await session.scalars(stmt)).all()
    return [_public_to_dict(r) for r in rows]


async def get_public_exercise(session: AsyncSession, item_id: int) -> dict:
    row = await session.get(PublicExercise, item_id)
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="Not found")
    return _public_to_dict(row, with_author=True)


async def copy_public_exercise_to_catalog(
    session: AsyncSession, public_id: int, auth_user: PgUser
) -> dict:
    row = await session.get(PublicExercise, public_id)
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
        source_public_exercise_id=row.id,
    )
    return catalog_row_to_create_response(catalog_row)


async def publish_catalog_exercise(
    session: AsyncSession, catalog_id: int, auth_user: PgUser
) -> dict:
    catalog = await session.get(ExerciseInCatalog, catalog_id)
    if not catalog or catalog.user_id != auth_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    existing = await session.scalar(
        select(PublicExercise).where(
            PublicExercise.source_catalog_id == catalog_id,
            PublicExercise.author_user_id == auth_user.id,
        )
    )
    fields = {
        "name": catalog.name,
        "notes": catalog.notes,
        "muscle_group": catalog.muscle_group,
        "machine_location": catalog.machine_location,
        "machine_settings": catalog.machine_settings,
        "icon": catalog.icon,
        "image": catalog.image,
        "is_active": True,
    }
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        await session.commit()
        await session.refresh(existing)
        return {
            "message": "Exercise republished",
            "public_exercise_id": existing.id,
        }

    public_row = PublicExercise(
        author_user_id=auth_user.id,
        source_catalog_id=catalog.id,
        **fields,
    )
    session.add(public_row)
    await session.commit()
    await session.refresh(public_row)
    return {
        "message": "Exercise published",
        "public_exercise_id": public_row.id,
    }


async def unpublish_catalog_exercise(
    session: AsyncSession, catalog_id: int, auth_user: PgUser
) -> dict:
    catalog = await session.get(ExerciseInCatalog, catalog_id)
    if not catalog or catalog.user_id != auth_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    row = await session.scalar(
        select(PublicExercise).where(
            PublicExercise.source_catalog_id == catalog_id,
            PublicExercise.author_user_id == auth_user.id,
            PublicExercise.is_active.is_(True),
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="Publication not found")
    row.is_active = False
    await session.commit()
    return {"status": "unpublished"}
