"""Схемы GET /api/v1/user_weights/diary (экран /weight-diary)."""

from datetime import datetime

from typing import Optional

from pydantic import BaseModel, Field


class WeightDiaryMeasurementOut(BaseModel):
    """Одно измерение в журнале веса."""

    id: int = Field(..., description="ID записи")
    measured_at: datetime = Field(
        ...,
        description="Дата и время измерения (ISO 8601), например 2026-07-14T07:20:00",
        examples=["2026-07-14T07:20:00", "2026-07-14T07:20:00+03:00"],
    )
    weight_kg: float = Field(..., description="Вес, кг")
    body_fat_percent: Optional[float] = Field(
        default=None, description="Телесный жир, % (если указан в записи)"
    )
    body_score: Optional[float] = Field(
        default=None,
        description="Оценка тела по весу и росту; null, если рост не указан",
    )
    note: Optional[str] = Field(default=None, description="Заметка к измерению")
