"""Схемы ExerciseInWorkout для API (PostgreSQL)."""

from typing import Literal, Optional

from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field
from schemas.utils.common_parts import _Message, _Row, _Id
from schemas.utils.update_model import make_update_model
from schemas.exercise_in_workout_set import SetScheme
from schemas.planned_set_timeline import PlannedSetTimelineEntry
from utils.workout_duration import is_exercise_active


class ExerciseInWorkoutScheme(BaseModel):
    """Схема ExerciseInWorkout"""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    exercise_in_catalog_id: Optional[int] = Field(
        default=None,
        serialization_alias="exercise_in_catalog_id",
        description="ID упражнения из каталога",
    )
    workout_id: int = Field(..., description="ID тренировки")
    order_index: int = Field(..., description="Порядковый номер")
    start_time: Optional[datetime] = Field(default=None)
    end_time: Optional[datetime] = Field(default=None)
    sets_json: list[SetScheme] = Field(
        default_factory=list,
        description="Массив подходов (JSON)",
        validation_alias=AliasChoices("sets_json", "timeline"),
    )
    planned_sets_json: list[PlannedSetTimelineEntry] = Field(
        default_factory=list,
        description="Запланированные подходы и отдыхи (шаблон тренировки)",
    )
    planned_sets_count: Optional[int] = Field(
        default=None,
        ge=1,
        le=999,
        validation_alias=AliasChoices("planned_sets_count", "planned_sets"),
        serialization_alias="planned_sets_count",
        description="Запланированное число подходов (legacy fallback, если planned_sets_json пуст)",
    )
    note: Optional[str] = Field(default=None)


class ExerciseInWorkoutCreate(ExerciseInWorkoutScheme):
    """Схема добавления упражнения в тренировку."""


class ExerciseInWorkoutCreateResponse(ExerciseInWorkoutScheme, _Row, _Message):
    """Ответ после создания упражнения в тренировке."""


class ExerciseInWorkoutReplace(ExerciseInWorkoutScheme):
    """Полная замена записи упражнения в тренировке."""


class ExerciseInWorkoutReplaceResponse(BaseModel):
    """Ответ PUT после полной замены."""

    status: Literal["updated"] = Field(default="updated", description="Статус операции")


ExerciseInWorkoutPatch = make_update_model(
    ExerciseInWorkoutScheme, "ExerciseInWorkoutPatch"
)
ExerciseInWorkoutPatch.__doc__ = (
    "Тело PATCH: частичное обновление (только переданные поля)."
)


class ExerciseInWorkoutPatchResponse(BaseModel):
    """Ответ PATCH после частичного обновления."""

    status: Literal["updated"] = Field(default="updated", description="Статус операции")


class ExerciseInWorkoutOut(ExerciseInWorkoutScheme, _Row):
    """Схема ответа с данными упражнения в тренировке."""

    model_config = ConfigDict(from_attributes=True)

    @computed_field(
        return_type=bool,
        description="Упражнение идёт: есть открытый START без последующего END в sets_json.",
    )
    @property
    def is_active(self) -> bool:
        return is_exercise_active(self)


class ExerciseInWorkoutDeleteResponse(BaseModel):
    """Ответ DELETE."""

    status: Literal["deleted"] = Field(default="deleted", description="Статус операции")


class ExerciseInWorkoutInWorkoutOut(ExerciseInWorkoutScheme, _Id):
    """
    Упражнение внутри ответа GET /workouts и списка: id строки exercise_in_workout.
    Не наследуем ExerciseInWorkoutOut — там миксин _Row (user_id, created_at), их нет
    во вложенном объекте и дублируют поля тренировки.

    start_time/end_time не в JSON (exclude), но участвуют при валидации из словаря сервиса.
    """

    # extra=ignore: fastapi-cache2 отдаёт dict с сериализованным is_active (@computed_field).
    model_config = ConfigDict(
        str_strip_whitespace=True, extra="ignore", from_attributes=True
    )

    start_time: Optional[datetime] = Field(default=None, exclude=True)
    end_time: Optional[datetime] = Field(default=None, exclude=True)

    @computed_field(
        return_type=bool,
        description="Упражнение идёт: есть открытый START без последующего END в sets_json.",
    )
    @property
    def is_active(self) -> bool:
        return is_exercise_active(self)
