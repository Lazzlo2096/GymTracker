"""Дневник веса: GET /api/v1/user_weights/diary (экран mobile /weight-diary)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from cache_groups import CacheGroup, mark_cache_group
from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.weight_diary import WeightDiaryMeasurementOut
from services.postgres.weight_diary_actions import list_weight_diary_measurements
from utils.query_datetime import (
    PREFERRED_DT_EXAMPLE,
    PREFERRED_DT_HINT,
    parse_query_datetime,
)

router = APIRouter(prefix="/user_weights", tags=["user_weights"])


@router.get(
    "/diary",
    response_model=list[WeightDiaryMeasurementOut],
    summary="Журнал измерений веса",
    description=(
        "Список измерений текущего пользователя из user_weights. "
        "Фильтры start_date / end_date ограничивают measured_at (включительно). "
        f"{PREFERRED_DT_HINT} "
        "body_score вычисляется по весу и росту из профиля."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def get_weight_diary(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    start_date: Annotated[
        str | None,
        Query(
            description=(
                f"Начало диапазона measured_at, включительно. {PREFERRED_DT_HINT}"
            ),
            examples=[PREFERRED_DT_EXAMPLE, "2026-05-01T000000Z"],
        ),
    ] = None,
    end_date: Annotated[
        str | None,
        Query(
            description=(
                f"Конец диапазона measured_at, включительно. {PREFERRED_DT_HINT}"
            ),
            examples=["2026-08-05T235959Z", PREFERRED_DT_EXAMPLE],
        ),
    ] = None,
    limit: Annotated[
        int | None,
        Query(
            ge=1,
            le=500,
            description="Максимум записей в ответе",
            examples=[50, 100],
        ),
    ] = None,
) -> list[WeightDiaryMeasurementOut]:
    start_dt = parse_query_datetime(start_date, field="start_date")
    end_dt = parse_query_datetime(end_date, field="end_date")

    if start_dt is not None and end_dt is not None and start_dt > end_dt:
        raise HTTPException(
            status_code=400,
            detail="start_date не может быть позже end_date",
        )

    return await list_weight_diary_measurements(
        session,
        auth_user,
        start_date=start_dt,
        end_date=end_dt,
        limit=limit,
    )
