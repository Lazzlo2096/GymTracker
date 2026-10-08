"""Каталог упражнений в PostgreSQL."""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import asc, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from crud.filter_schema import CommonListQuery
from db.models.postgres import ExerciseInCatalog


def _day_start_utc(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _day_end_exclusive_utc(d: date) -> datetime:
    return _day_start_utc(d) + timedelta(days=1)


async def list_exercises(
    session: AsyncSession,
    *,
    scope_user_ids: list[int] | None = None,
    sort_by: str | None = None,
    sort_desc: bool = True,
    limit: int | None = None,
    offset: int | None = None,
    common: CommonListQuery | None = None,
    muscle_group: str | None = None,
) -> list[ExerciseInCatalog]:
    common = common or CommonListQuery()
    stmt = select(ExerciseInCatalog)

    if scope_user_ids is not None:
        stmt = stmt.where(ExerciseInCatalog.user_id.in_(scope_user_ids))

    if common.q:
        pat = f"%{common.q}%"
        stmt = stmt.where(
            or_(
                ExerciseInCatalog.name.ilike(pat),
                ExerciseInCatalog.notes.ilike(pat),
                ExerciseInCatalog.muscle_group.ilike(pat),
            ),
        )

    if common.date_from is not None:
        stmt = stmt.where(
            ExerciseInCatalog.created_at >= _day_start_utc(common.date_from)
        )
    if common.date_to is not None:
        stmt = stmt.where(
            ExerciseInCatalog.created_at < _day_end_exclusive_utc(common.date_to)
        )

    if muscle_group is not None and muscle_group.strip():
        stmt = stmt.where(ExerciseInCatalog.muscle_group == muscle_group.strip())

    order_col = getattr(ExerciseInCatalog, sort_by, None) if sort_by else None
    if order_col is not None:
        stmt = stmt.order_by(desc(order_col) if sort_desc else asc(order_col))
    else:
        stmt = stmt.order_by(asc(ExerciseInCatalog.name))

    if limit is not None:
        stmt = stmt.limit(limit)
    if offset is not None:
        stmt = stmt.offset(offset)

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def find_by_name_for_user(
    session: AsyncSession,
    name: str,
    user_id: int,
) -> ExerciseInCatalog | None:
    result = await session.execute(
        select(ExerciseInCatalog).where(
            ExerciseInCatalog.name == name,
            ExerciseInCatalog.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()
