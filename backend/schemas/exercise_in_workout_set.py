"""Pydantic-схемы для записей в `sets_json` упражнения в тренировке."""

from __future__ import annotations

from datetime import datetime as Datetime
from typing import Annotated, List, Literal, Optional, Union

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from schemas.weight_composition import WeightCompositionV1

SetEffortLevel = Literal["легко", "отлично", "на грани", "тяжело"]


class _SetEntryBase(BaseModel):
    """Базовая модель одной записи в логе упражнения."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class MarkSetEntry(_SetEntryBase):
    """Служебная отметка начала/конца упражнения."""

    type: Literal["mark"] = "mark"

    mark_type: Literal["start", "end"] = Field(
        ..., description="Тип отметки: start | end"
    )
    datetime: Datetime = Field(
        ...,
        description="Когда произошла отметка (ISO datetime).",
        validation_alias=AliasChoices("datetime", "happened_at"),
        serialization_alias="datetime",
    )
    comment: Optional[str] = Field(
        default=None, max_length=512, description="Комментарий к отметке"
    )


class WorkoutSetEntry(_SetEntryBase):
    """Рабочий подход с весом/повторами и метаданными."""

    type: Literal["set"] = "set"

    # В т.ч. отрицательные значения для тренажёров вроде гравитрона.
    weight_kg: Optional[float] = Field(
        default=None,
        description="Вес (кг), может быть отрицательным.",
    )
    weight_string: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Произвольная подпись веса (текст UI); не связана с weight_kg.",
    )
    weight_composition: Optional[WeightCompositionV1] = Field(
        default=None,
        description="Структурированный состав веса (weight_composition v1).",
    )
    reps: Optional[int] = Field(default=None, ge=0, description="Количество повторений")
    reps_string: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Произвольная подпись повторений (текст UI); не связана с reps.",
    )
    comment: Optional[str] = Field(
        default=None, max_length=512, description="Комментарий к подходу"
    )
    set_seconds: Optional[int] = Field(
        default=None,
        ge=0,
        description="Длительность подхода в секундах.",
        validation_alias=AliasChoices("set_seconds", "duration_seconds"),
        serialization_alias="set_seconds",
    )
    heart_rate_right_after: Optional[int] = Field(
        default=None,
        ge=0,
        le=300,
        description="Пульс сразу после подхода.",
    )
    rating: Optional[int] = Field(
        default=None, ge=1, le=10, description="Субъективная оценка подхода"
    )
    reached_failure: Optional[bool] = Field(
        default=None,
        description="Подход выполнен до отказа.",
        serialization_alias="reached_failure",
    )
    effort_level: Optional[SetEffortLevel] = Field(
        default=None,
        description="Субъективная оценка нагрузки: легко | отлично | на грани | тяжело.",
    )


class CommentSetEntry(_SetEntryBase):
    """Отдельный комментарий в таймлайне упражнения."""

    type: Literal["comment"] = "comment"

    datetime: Optional[Datetime] = Field(
        default=None,
        description="Когда произошло событие, к которому относится комментарий.",
        validation_alias=AliasChoices("datetime", "happened_at"),
        serialization_alias="datetime",
    )
    # creation_datetime: Optional[Datetime] = Field(
    #    default=None,
    #    description="Когда комментарий был фактически создан/внесён.",
    #    validation_alias=AliasChoices("creation_datetime", "created_at"),
    #    serialization_alias="creation_datetime",
    # )
    comment: str = Field(
        ..., min_length=1, max_length=512, description="Текст комментария"
    )


class RestSetEntry(_SetEntryBase):
    """Запись об отдыхе между подходами."""

    type: Literal["rest"] = "rest"

    rest_seconds: int = Field(
        ...,
        ge=0,
        description="Длительность отдыха в секундах.",
        validation_alias=AliasChoices("rest_seconds", "duration_seconds"),
        serialization_alias="rest_seconds",
    )
    comment: Optional[str] = Field(
        default=None, max_length=512, description="Комментарий к отдыху"
    )


SetScheme = Annotated[
    Union[MarkSetEntry, WorkoutSetEntry, CommentSetEntry, RestSetEntry],
    Field(discriminator="type"),
]

SetData = SetScheme


class SetUpdate(BaseModel):
    """Частичное обновление записи в логе (любые поля опциональны)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    type: Optional[Literal["mark", "set", "comment", "rest"]] = None
    mark_type: Optional[Literal["start", "end"]] = None
    datetime: Optional[Datetime] = Field(
        default=None,
        validation_alias=AliasChoices("datetime", "happened_at"),
        serialization_alias="datetime",
    )
    creation_datetime: Optional[Datetime] = Field(
        default=None,
        validation_alias=AliasChoices("creation_datetime", "created_at"),
        serialization_alias="creation_datetime",
    )
    weight_kg: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("weight_kg", "weight")
    )
    weight_string: Optional[str] = Field(default=None, max_length=128)
    weight_composition: Optional[WeightCompositionV1] = None
    reps: Optional[int] = Field(default=None, ge=0)
    reps_string: Optional[str] = Field(default=None, max_length=128)
    comment: Optional[str] = Field(default=None, max_length=512)
    set_seconds: Optional[int] = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("set_seconds", "duration_seconds"),
        serialization_alias="set_seconds",
    )
    rest_seconds: Optional[int] = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("rest_seconds", "duration_seconds"),
        serialization_alias="rest_seconds",
    )
    heart_rate_right_after: Optional[int] = Field(default=None, ge=0, le=300)
    rating: Optional[int] = Field(default=None, ge=1, le=10)
    reached_failure: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("reached_failure", "is_failure", "отказ"),
        serialization_alias="reached_failure",
    )
    effort_level: Optional[SetEffortLevel] = None


class PlannedSetsUpdate(BaseModel):
    """PATCH planned_sets: обновление запланированного числа подходов."""

    planned_sets_count: Optional[int] = Field(
        default=None,
        ge=1,
        le=999,
        validation_alias=AliasChoices("planned_sets_count", "planned_sets"),
        serialization_alias="planned_sets_count",
        description="Сколько подходов планирует сделать",
    )


class AddSetResponse(BaseModel):
    """Ответ после добавления записи в лог."""

    message: str
    exercise_in_workout_id: int
    added_set: dict
    all_sets: List[dict]


class UpdateSetResponse(BaseModel):
    """Ответ после обновления записи в логе по индексу."""

    message: str
    exercise_in_workout_id: int
    updated_index: int
    updated_set: dict
    all_sets: List[dict]


class UpdateSetsResponse(BaseModel):
    """Ответ после полной замены массива записей."""

    message: str
    exercise_in_workout_id: int
    updated_sets: List[dict]


class PlannedSetsResponse(BaseModel):
    """Ответ после обновления planned_sets_count."""

    message: str
    exercise_in_workout_id: int
    planned_sets_count: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("planned_sets_count", "planned_sets"),
        serialization_alias="planned_sets_count",
    )


class DeleteSetResponse(BaseModel):
    """Ответ после удаления записи по индексу."""

    message: str
    exercise_in_workout_id: int
    deleted_index: int
    deleted_set: dict
    remaining_sets: List[dict]


class AddPlannedSetResponse(BaseModel):
    """Ответ после добавления записи в planned_sets_json."""

    message: str
    exercise_in_workout_id: int
    added_set: dict
    all_planned_sets: List[dict]


class UpdatePlannedSetResponse(BaseModel):
    """Ответ после обновления записи в planned_sets_json по индексу."""

    message: str
    exercise_in_workout_id: int
    updated_index: int
    updated_set: dict
    all_planned_sets: List[dict]


class DeletePlannedSetResponse(BaseModel):
    """Ответ после удаления записи из planned_sets_json по индексу."""

    message: str
    exercise_in_workout_id: int
    deleted_index: int
    deleted_set: dict
    remaining_planned_sets: List[dict]
