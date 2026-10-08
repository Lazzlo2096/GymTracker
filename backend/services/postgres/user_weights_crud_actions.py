"""CRUD /api/v1/user_weights/ (PostgreSQL)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import asc, desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from crud.filter_schema import CommonListQuery
from db.models.postgres.user import User
from db.models.postgres.user_weight import UserWeight
from services.postgres.catalog_access import can_access_catalog_owner
from utils.db_errors import rollback_and_raise_integrity


def user_weight_to_dict(row: UserWeight) -> dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "measured_at": row.measured_at,
        "weight_kg": float(row.weight_kg),
        "body_fat_percent": (
            float(row.body_fat_percent) if row.body_fat_percent is not None else None
        ),
        "note": row.note,
        "created_at": row.created_at,
    }


def _parse_owner_id(owner: str | None) -> int | None:
    if owner is None:
        return None
    s = str(owner).strip()
    if not s or not s.isdigit():
        return None
    return int(s, 10)


def _day_start_utc(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _day_end_exclusive_utc(d: date) -> datetime:
    return _day_start_utc(d) + timedelta(days=1)


async def _require_weight_owner(
    session: AsyncSession,
    auth_user: User,
    requested_user_id: int | None,
) -> int:
    """Свой журнал — всегда. Чужой id — только admin или тренер этого пользователя."""
    target = auth_user.id if requested_user_id is None else requested_user_id
    if await can_access_catalog_owner(session, auth_user, target):
        return target

    raise HTTPException(
        status_code=403,
        detail="Нет доступа к весу этого пользователя",
    )


async def _load_accessible_weight(
    session: AsyncSession,
    auth_user: User,
    item_id: int,
) -> UserWeight | None:
    row = await session.get(UserWeight, item_id)
    if row is None:
        return None
    if not await can_access_catalog_owner(session, auth_user, row.user_id):
        return None
    return row


async def create_user_weight(
    session: AsyncSession,
    *,
    auth_user: User,
    requested_user_id: int | None,
    weight_kg: float,
    measured_at: datetime | None = None,
    body_fat_percent: float | None = None,
    note: str | None = None,
) -> tuple[dict[str, int], int]:
    user_id = await _require_weight_owner(session, auth_user, requested_user_id)
    row = UserWeight(
        user_id=user_id,
        measured_at=measured_at or datetime.utcnow(),
        weight_kg=weight_kg,
        body_fat_percent=body_fat_percent,
        note=note,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Измерение на этот момент уже существует",
            other_detail="Не удалось сохранить измерение веса",
        )
    await session.refresh(row)
    return {"id": row.id}, user_id


async def list_user_weights(
    session: AsyncSession,
    auth_user: User,
    filters: dict[str, Any],
    sort_by: str | None,
    sort_desc: bool,
    limit: int | None,
    offset: int | None,
    common: CommonListQuery,
) -> list[dict[str, Any]]:
    requested = filters.get("user_id")
    owner_id = _parse_owner_id(common.owner)
    if (
        isinstance(requested, int)
        and owner_id is not None
        and requested != owner_id
    ):
        raise HTTPException(
            status_code=422,
            detail="user_id и owner указывают на разных пользователей",
        )

    target_request = requested if isinstance(requested, int) else owner_id
    target = await _require_weight_owner(session, auth_user, target_request)

    stmt = select(UserWeight).where(UserWeight.user_id == target)

    row_pk = filters.get("id")
    if row_pk is not None:
        stmt = stmt.where(UserWeight.id == row_pk)

    if common.q:
        pat = f"%{common.q}%"
        stmt = stmt.where(UserWeight.note.ilike(pat))

    if common.date_from is not None:
        stmt = stmt.where(UserWeight.measured_at >= _day_start_utc(common.date_from))
    if common.date_to is not None:
        stmt = stmt.where(
            UserWeight.measured_at < _day_end_exclusive_utc(common.date_to)
        )

    order_col = getattr(UserWeight, sort_by, None) if sort_by else None
    if order_col is not None:
        stmt = stmt.order_by(desc(order_col) if sort_desc else asc(order_col))
    else:
        stmt = stmt.order_by(desc(UserWeight.measured_at))

    if limit is not None:
        stmt = stmt.limit(limit)
    if offset is not None:
        stmt = stmt.offset(offset)

    result = await session.execute(stmt)
    rows = list(result.scalars().all())
    return [user_weight_to_dict(r) for r in rows]


async def get_user_weight(
    session: AsyncSession,
    auth_user: User,
    item_id: int,
) -> dict[str, Any] | None:
    row = await _load_accessible_weight(session, auth_user, item_id)
    return user_weight_to_dict(row) if row else None


async def update_user_weight(
    session: AsyncSession,
    auth_user: User,
    item_id: int,
    patch: dict[str, Any],
) -> int | None:
    row = await _load_accessible_weight(session, auth_user, item_id)
    if not row:
        return None

    data = dict(patch)
    if "weight_kg" in data and data["weight_kg"] is not None:
        data["weight_kg"] = float(data["weight_kg"])
    if "body_fat_percent" in data and data["body_fat_percent"] is not None:
        data["body_fat_percent"] = float(data["body_fat_percent"])
    allowed = {"measured_at", "weight_kg", "body_fat_percent", "note"}
    nullable_clear = {"note", "body_fat_percent"}
    for k, v in data.items():
        if k not in allowed:
            continue
        if v is None and k not in nullable_clear:
            continue
        setattr(row, k, v)

    owner_id = row.user_id
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Измерение на этот момент уже существует",
            other_detail="Не удалось сохранить измерение веса",
        )
    return owner_id


async def delete_user_weight(
    session: AsyncSession,
    auth_user: User,
    item_id: int,
) -> int | None:
    row = await _load_accessible_weight(session, auth_user, item_id)
    if not row:
        return None
    owner_id = row.user_id
    await session.delete(row)
    await session.commit()
    return owner_id
