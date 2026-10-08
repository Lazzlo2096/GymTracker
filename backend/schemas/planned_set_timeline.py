"""Схемы запланированного таймлайна упражнения (шаблон тренировки)."""

from __future__ import annotations

from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class _PlannedTimelineEntryBase(BaseModel):
    """Базовая запись плана подхода/отдыха."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class PlannedWorkoutSetEntry(_PlannedTimelineEntryBase):
    """Запланированный рабочий подход."""

    type: Literal["set"] = "set"

    weight_kg: Optional[float] = Field(
        default=None,
        description="Вес (кг), может быть отрицательным.",
    )
    weight_string: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Произвольная подпись веса (текст UI).",
    )
    reps: Optional[int] = Field(default=None, ge=0, description="Количество повторений")
    reps_string: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Произвольная подпись повторений (текст UI).",
    )


class PlannedRestSetEntry(_PlannedTimelineEntryBase):
    """Запланированный отдых между подходами."""

    type: Literal["rest"] = "rest"

    rest_seconds: int = Field(
        ...,
        ge=0,
        description="Длительность отдыха в секундах.",
    )


PlannedSetTimelineEntry = Annotated[
    Union[PlannedWorkoutSetEntry, PlannedRestSetEntry],
    Field(discriminator="type"),
]
