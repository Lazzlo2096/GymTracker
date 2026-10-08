"""Схемы API для идей и улучшений (feature_ideas)."""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from schemas.utils.common_parts import _Message


class FeatureIdeaStatusOut(str, Enum):
    """Чип статуса в публичном списке."""

    IN_DEVELOPMENT = "in_development"
    ACCEPTED_TO_PLAN = "accepted_to_plan"


class FeatureIdeaCreate(BaseModel):
    """Тело POST: предложить идею (на модерации до is_approved в БД)."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(..., min_length=3, max_length=256)
    description: str = Field(..., min_length=10, max_length=4096)
    icon_key: str | None = Field(
        default=None,
        max_length=64,
        description="Ключ иконки для UI (опционально)",
    )


class FeatureIdeaCreateResponse(_Message):
    """Ответ после отправки идеи."""

    id: int
    is_approved: bool = Field(
        default=False,
        description="Станет true после ручной модерации в БД",
    )


class FeatureIdeaPublicOut(BaseModel):
    """Опубликованная идея — без данных автора."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    icon_key: str | None = None
    status: FeatureIdeaStatusOut | None = Field(
        default=None,
        description="Чип: в разработке / принят в план; null — без чипа",
    )
    likes_count: int = Field(0, ge=0)
    liked_by_me: bool = False
    created_at: datetime


FeatureIdeaSort = Literal["new", "popular"]


class FeatureIdeaLikeToggleResponse(BaseModel):
    """Ответ POST toggle like."""

    liked_by_me: bool
    likes_count: int = Field(..., ge=0)
