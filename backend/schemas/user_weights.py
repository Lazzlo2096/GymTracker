"""Схемы для эндпоинтов user_weights (PostgreSQL)."""

from typing import Optional
from datetime import datetime

from pydantic import BaseModel, Field


class UserWeightCrudCreate(BaseModel):
    """Тело POST /api/v1/user_weights/."""

    user_id: Optional[int] = Field(
        default=None,
        description="users.id владельца. Пусто — текущий пользователь. Чужой id только у admin или тренера этой учётки",
    )
    measured_at: Optional[datetime] = None
    weight_kg: float = Field(..., gt=0)
    body_fat_percent: Optional[float] = Field(default=None, gt=0, le=100)
    note: Optional[str] = None


class UserWeightCrudUpdate(BaseModel):
    """Тело PUT /api/v1/user_weights/{id}. Владелец записи не меняется."""

    measured_at: Optional[datetime] = None
    weight_kg: Optional[float] = Field(default=None, gt=0)
    body_fat_percent: Optional[float] = Field(default=None, gt=0, le=100)
    note: Optional[str] = None


class UserWeightCrudFilter(BaseModel):
    """Query-фильтры GET /api/v1/user_weights/."""

    id: Optional[int] = None
    user_id: Optional[int] = None
