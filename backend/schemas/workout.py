"""Схемы Workout для API (PostgreSQL)."""

from typing import Annotated, Literal, Optional, List
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, computed_field, AliasChoices
from fastapi import Path

from schemas.exercise_in_workout import (
    ExerciseInWorkoutInWorkoutOut,
    ExerciseInWorkoutScheme,
)
from schemas.utils.common_parts import _Message, _Row, PageResponse
from schemas.user_gym import UserGymOutBrief
from utils.workout_duration import compute_workout_duration_minutes, is_workout_active


class _WorkoutScheme(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    workout_date: date = Field(..., description="Дата тренировки")
    day_title: Optional[str] = Field(default=None, description="Название дня")
    note: Optional[str] = Field(default=None, description="Заметка")
    user_gym_id: Optional[int] = Field(
        default=None, description="Фитнес-зал пользователя (user_gyms.id)"
    )


class WorkoutScheme(_WorkoutScheme):
    """Схема Workout"""

    exercises: List[ExerciseInWorkoutScheme] = Field(
        default_factory=list,
        description="Упражнения",
        validation_alias=AliasChoices(
            "exercises", "timeline"
        ),  # "exercises" is DEPRECATED !
    )

    @computed_field(
        return_type=float, description="Сумма вес×повторы по всем подходам (кг)"
    )
    @property
    def tonnage_kg(self) -> float:
        tonnage: float = 0.0
        for exercise in self.exercises:
            for set_item in exercise.sets_json:
                reps = getattr(set_item, "reps", None)
                if reps is None:
                    continue
                weight_kg = getattr(set_item, "weight_kg", None) or 0.0
                tonnage += weight_kg * reps
        return tonnage

    @computed_field(return_type=int, description="Количество упражнений в тренировке")
    @property
    def exercises_count(self) -> int:
        return len(self.exercises)

    @computed_field(
        return_type=Optional[int],
        description=(
            "Длительность тренировки в минутах: START первого упражнения → "
            "END последнего; если END нет — до текущего момента (тренировка идёт)."
        ),
    )
    @property
    def duration_minutes(self) -> Optional[int]:
        return compute_workout_duration_minutes(self.exercises)

    @computed_field(
        return_type=bool,
        description="Тренировка идёт: есть хотя бы одно упражнение с is_active=true.",
    )
    @property
    def is_active(self) -> bool:
        return is_workout_active(self.exercises)


# Path / query типы
WorkoutIdPath = Annotated[int, Path(..., description="ID тренировки")]
UserIdPath = Annotated[int, Path(..., description="ID пользователя")]
ExerciseIdPath = Annotated[int, Path(..., description="ID упражнения")]


class WorkoutRepeatBody(BaseModel):
    """Тело POST /workouts/{id}/repeat (все поля опциональны)."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    workout_date: Optional[date] = Field(
        default=None,
        description="Дата новой тренировки (по умолчанию: исходная + 1 день)",
    )
    day_title: Optional[str] = Field(
        default=None,
        description="Название дня (по умолчанию: префикс «повтор: …»)",
    )


class WorkoutCreate(_WorkoutScheme):
    """Схема создания тренировки."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class WorkoutCreateResponse(WorkoutScheme, _Row, _Message):
    """Ответ после создания тренировки."""

    user_gym: Optional[UserGymOutBrief] = Field(
        default=None,
        description="Связанный фитнес-зал (если передан user_gym_id при создании)",
    )


class WorkoutReplace(WorkoutScheme):
    """Схема полной замены тренировки."""


class WorkoutReplaceResponse(BaseModel):
    """Ответ PUT после полной замены."""

    status: Literal["updated"] = Field(default="updated", description="Статус операции")


class WorkoutPatch(WorkoutScheme):
    """Тело PATCH: частичное обновление (только переданные поля)."""

    workout_date: Optional[date] = None
    day_title: Optional[str] = None
    note: Optional[str] = None
    user_gym_id: Optional[int] = None


class WorkoutPatchResponse(BaseModel):
    """Ответ PATCH после частичного обновления."""

    status: Literal["updated"] = Field(default="updated", description="Статус операции")


class WorkoutOut(WorkoutScheme, _Row):
    """Схема ответа с данными тренировки."""

    model_config = ConfigDict(from_attributes=True)
    exercises: List[ExerciseInWorkoutInWorkoutOut] = Field(
        default_factory=list,
        description="Упражнения",
        validation_alias=AliasChoices("exercises", "timeline"),
    )
    user_gym: Optional[UserGymOutBrief] = Field(
        default=None,
        description="Связанный фитнес-зал пользователя (если user_gym_id задан)",
    )
    # exercises: List[ExerciseInWorkoutScheme] = Field(default_factory=list, exclude=True)
    # created_at # , exclude=True


class WorkoutRepeatResponse(WorkoutOut, _Message):
    """Ответ после повтора тренировки (план на новую дату, с упражнениями и id строк)."""


class WorkoutOutPaginatedList(PageResponse[WorkoutOut]):
    counts_by_month: dict[str, int] = Field(
        default_factory=dict,
        description=(
            "Число тренировок по месяцам для текущих фильтров (без limit/offset). "
            "Ключ «YYYY-M», M — месяц 0..11 как Date.getMonth() в JavaScript."
        ),
    )


class WorkoutDeleteResponse(BaseModel):
    """Ответ DELETE."""

    status: Literal["deleted"] = Field(default="deleted", description="Статус операции")


class AddExerciseToWorkoutResponse(_Message):
    """Ответ после добавления упражнения в тренировку."""

    workout_id: int = Field(..., description="ID тренировки")
    exercise_id: int = Field(
        ..., description="ID записи упражнения в тренировке (exercise_in_workout в PG)"
    )
