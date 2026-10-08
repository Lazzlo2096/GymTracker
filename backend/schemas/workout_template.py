"""Схемы шаблона тренировки (план без фактического лога подходов)."""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from schemas.planned_set_timeline import PlannedSetTimelineEntry
from schemas.user_gym import UserGymOutBrief


class ExerciseInWorkoutTemplate(BaseModel):
    """Упражнение в шаблоне: пустой sets_json и заполненный planned_sets_json."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    id: Optional[int] = Field(
        default=None, description="ID exercise_in_workout (если сохранён)"
    )
    exercise_in_catalog_id: Optional[int] = Field(
        default=None,
        description="ID упражнения из каталога",
    )
    workout_id: Optional[int] = Field(default=None, description="ID тренировки")
    order_index: int = Field(..., description="Порядковый номер")
    sets_json: list = Field(
        default_factory=list,
        description="Фактический лог подходов (в шаблоне всегда пустой)",
    )
    planned_sets_json: List[PlannedSetTimelineEntry] = Field(
        default_factory=list,
        description="Запланированные подходы и отдыхи",
    )
    planned_sets_count: Optional[int] = Field(
        default=None,
        ge=1,
        le=999,
        description=(
            "Запланированное число подходов (legacy fallback, если planned_sets_json пуст)"
        ),
    )
    note: Optional[str] = Field(default=None)


class WorkoutTemplate(BaseModel):
    """Тренировка-шаблон: структура и план без выполненного лога."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    id: Optional[int] = Field(
        default=None, description="ID тренировки (если сохранена)"
    )
    user_id: Optional[int] = Field(default=None, description="ID пользователя")
    created_at: Optional[datetime] = Field(
        default=None,
        description="Дата создания (для нового шаблона — null)",
    )
    workout_date: date = Field(..., description="Дата запланированной тренировки")
    day_title: Optional[str] = Field(default=None, description="Название дня")
    note: Optional[str] = Field(default=None, description="Заметка")
    user_gym_id: Optional[int] = Field(
        default=None,
        description="Фитнес-зал пользователя (user_gyms.id)",
    )
    user_gym: Optional[UserGymOutBrief] = Field(
        default=None,
        description="Связанный фитнес-зал",
    )
    exercises: List[ExerciseInWorkoutTemplate] = Field(
        default_factory=list,
        description="Упражнения шаблона",
    )
