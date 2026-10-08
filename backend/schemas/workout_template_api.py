"""Схемы API шаблонов тренировок (библиотека планов, экран «Планы»)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class TemplatePlannedSetWorkOut(BaseModel):
    """Запланированный рабочий подход (ответ API)."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["set"] = "set"
    weight_kg: Optional[float] = Field(default=None, description="Вес в кг")
    reps: Optional[int] = Field(default=None, ge=0, description="Повторения")
    weight_label: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Подпись веса для UI",
    )
    reps_label: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Подпись повторений для UI",
    )


class TemplatePlannedRestOut(BaseModel):
    """Запланированный отдых между подходами."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["rest"] = "rest"
    rest_seconds: int = Field(..., ge=0, description="Длительность отдыха, сек")


TemplatePlannedSetOut = Annotated[
    Union[TemplatePlannedSetWorkOut, TemplatePlannedRestOut],
    Field(discriminator="type"),
]


class WorkoutTemplateExerciseOut(BaseModel):
    """Упражнение в шаблоне."""

    model_config = ConfigDict(extra="forbid")

    id: int = Field(..., ge=1)
    exercise_in_catalog_id: Optional[int] = Field(
        default=None,
        ge=1,
        description="Ссылка на exercises_in_catalog",
    )
    name: str = Field(..., min_length=1, max_length=256)
    muscle_group: Optional[str] = Field(default=None, max_length=128)
    note: Optional[str] = Field(default=None, max_length=2000)
    planned_sets_count: Optional[int] = Field(default=None, ge=0)
    planned_tonnage_kg: Optional[float] = Field(default=None)
    planned_all_reps: Optional[int] = Field(default=None, ge=0)
    planned_all_weight_kg: Optional[float] = Field(default=None)
    planned_all_rest_seconds: Optional[int] = Field(default=None, ge=0)
    planned_sets: list[TemplatePlannedSetOut] = Field(default_factory=list)


class WorkoutTemplateSummaryOut(BaseModel):
    """Краткая карточка шаблона (вкладка «Шаблоны»)."""

    model_config = ConfigDict(extra="forbid")

    id: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = Field(default=None, max_length=512)
    gym_name: Optional[str] = Field(default=None, max_length=256)
    exercises_count: int = Field(..., ge=0)
    estimated_minutes: int = Field(..., ge=0)
    last_used_label: Optional[str] = Field(default=None, max_length=128)


class WorkoutTemplateDetailOut(WorkoutTemplateSummaryOut):
    """Полный шаблон с планом упражнений."""

    note: Optional[str] = Field(default=None, max_length=4000)
    exercises: list[WorkoutTemplateExerciseOut] = Field(default_factory=list)


class WorkoutTemplateListOut(BaseModel):
    """Список шаблонов пользователя."""

    model_config = ConfigDict(extra="forbid")

    items: list[WorkoutTemplateSummaryOut] = Field(default_factory=list)


class WorkoutTemplateExerciseIn(BaseModel):
    """Упражнение при создании/обновлении шаблона."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    exercise_in_catalog_id: Optional[int] = Field(default=None, ge=1)
    title_override: Optional[str] = Field(default=None, max_length=256)
    muscle_group: Optional[str] = Field(default=None, max_length=128)
    note: Optional[str] = Field(default=None, max_length=2000)
    planned_sets_count: Optional[int] = Field(default=None, ge=0)
    planned_tonnage_kg: Optional[float] = Field(default=None)
    planned_all_reps: Optional[int] = Field(default=None, ge=0)
    planned_all_weight_kg: Optional[float] = Field(default=None)
    planned_all_rest_seconds: Optional[int] = Field(default=None, ge=0)
    planned_sets: list[TemplatePlannedSetOut] = Field(default_factory=list)


class WorkoutTemplateCreate(BaseModel):
    """Тело POST: создание шаблона."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = Field(default=None, max_length=512)
    note: Optional[str] = Field(default=None, max_length=4000)
    user_gym_id: Optional[int] = Field(default=None, ge=1)
    estimated_minutes: Optional[int] = Field(default=None, ge=0)
    exercises: list[WorkoutTemplateExerciseIn] = Field(default_factory=list)


class WorkoutTemplatePatch(BaseModel):
    """Тело PATCH: частичное обновление шаблона."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=256)
    description: Optional[str] = Field(default=None, max_length=512)
    note: Optional[str] = Field(default=None, max_length=4000)
    user_gym_id: Optional[int] = Field(default=None, ge=1)
    estimated_minutes: Optional[int] = Field(default=None, ge=0)
    exercises: Optional[list[WorkoutTemplateExerciseIn]] = None
    last_used_at: Optional[datetime] = None
