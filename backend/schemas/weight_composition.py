"""Схема weight_composition v1 для записей type=set в sets_json."""

from __future__ import annotations

from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class _TermBase(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class BodyweightTerm(_TermBase):
    kind: Literal["bodyweight"] = "bodyweight"
    cached_bodyweight_kg: Optional[float] = Field(
        default=None,
        description="Снимок веса из дневника; только при source=user_bodyweight_history.",
    )
    user_entered_bodyweight_kg: Optional[float] = Field(
        default=None,
        description="Вес, введённый пользователем в конструкторе; только при source=user_entered_now.",
    )
    source: Optional[str] = Field(
        default=None,
        description="user_bodyweight_history | user_entered_now.",
    )


class PlatesTerm(_TermBase):
    kind: Literal["plates"] = "plates"
    kgs: list[float] = Field(default_factory=list, description="Массы блинов/утяжелителей, кг.")
    mirror: bool = Field(
        default=False,
        description="Если true — сумма kgs удваивается (обе стороны штанги).",
    )
    meta: dict = Field(
        default_factory=dict,
        description="Куда надеты блины: пояс, жилет, утяжелители и т.п. (meta.placement).",
    )


class BarTerm(_TermBase):
    kind: Literal["bar"] = "bar"
    bar_kg: Optional[float] = Field(
        default=None,
        description="Масса грифа/штанги без блинов, кг.",
    )
    meta: dict = Field(
        default_factory=dict,
        description="Подпись и пресет грифа (meta.label, meta.standard).",
    )


WeightCompositionTerm = Annotated[
    Union[BodyweightTerm, PlatesTerm, BarTerm],
    Field(discriminator="kind"),
]


class WeightCompositionV1(BaseModel):
    """Структурированный состав веса подхода (версия 1)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    version: Literal[1] = 1
    cached_effective_kg: Optional[float] = Field(
        default=None,
        description="Вычисляется из terms; не подменяет weight_kg автоматически.",
    )
    cached_display: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Вычисляется из terms; не подменяет weight_string автоматически.",
    )
    terms: list[WeightCompositionTerm] = Field(default_factory=list)
