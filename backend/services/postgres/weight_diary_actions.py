"""Дневник веса: чтение user_weights и вычисление body_score."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import User as PgUser
from db.models.postgres.user_weight import UserWeight
from schemas.weight_diary import WeightDiaryMeasurementOut
from services.postgres.user_profile_satellites import ensure_user_profile_satellites
from utils.body_score import body_score_from_weight_and_height


async def list_weight_diary_measurements(
    session: AsyncSession,
    user: PgUser,
    *,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int | None = None,
) -> list[WeightDiaryMeasurementOut]:
    """Измерения текущего пользователя из user_weights, новые сверху."""
    await ensure_user_profile_satellites(session, user)
    height_cm = user.fitness_data.height_cm if user.fitness_data else None

    stmt = select(UserWeight).where(UserWeight.user_id == user.id)
    if start_date is not None:
        stmt = stmt.where(UserWeight.measured_at >= start_date)
    if end_date is not None:
        stmt = stmt.where(UserWeight.measured_at <= end_date)
    stmt = stmt.order_by(desc(UserWeight.measured_at), desc(UserWeight.created_at))
    if limit is not None:
        stmt = stmt.limit(limit)

    rows = (await session.scalars(stmt)).all()

    return [
        WeightDiaryMeasurementOut(
            id=row.id,
            measured_at=row.measured_at,
            weight_kg=float(row.weight_kg),
            body_fat_percent=(
                float(row.body_fat_percent)
                if row.body_fat_percent is not None
                else None
            ),
            body_score=body_score_from_weight_and_height(
                float(row.weight_kg), height_cm
            ),
            note=row.note,
        )
        for row in rows
    ]
