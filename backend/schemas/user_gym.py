"""Схемы API для фитнес-залов пользователя (user_gyms)."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from schemas.utils.common_parts import _Id, _Message, _Row


class UserGymScheme(BaseModel):
    """Название и адрес зала."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Название зала (уникально в рамках пользователя)",
    )
    address: Optional[str] = Field(
        default=None, max_length=2048, description="Адрес или описание"
    )


class UserGymCreate(UserGymScheme):
    """Тело POST: создание зала (при совпадении имени — существующая запись)."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    is_favorite: bool = False
    rating: Optional[int] = Field(default=None)
    review_text: Optional[str] = Field(default=None, max_length=4096)
    last_visited_at: Optional[datetime] = None
    tags: list[str] = Field(default_factory=list)
    gallery_urls: list[str] = Field(default_factory=list)

    @field_validator("tags", mode="before")
    @classmethod
    def _tags_list(cls, v):
        if v is None:
            return []
        return v

    @field_validator("gallery_urls", mode="before")
    @classmethod
    def _gal_list(cls, v):
        if v is None:
            return []
        return v

    @field_validator("rating")
    @classmethod
    def _rating_create(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v < 1 or v > 5:
            raise ValueError("Оценка от 1 до 5")
        return v


class UserGymOut(UserGymScheme, _Row):
    """Запись зала (список GET и ответ PATCH)."""

    model_config = ConfigDict(from_attributes=True)

    is_favorite: bool = False
    is_archived: bool = False
    rating: Optional[int] = Field(default=None)
    review_text: Optional[str] = Field(default=None)
    review_updated_at: Optional[datetime] = None
    last_visited_at: Optional[datetime] = None
    tags: list[str] = Field(default_factory=list)
    gallery_urls: list[str] = Field(default_factory=list)
    visit_count: int = Field(0, ge=0, description="Число тренировок с этим залом")
    last_workout_date: Optional[date] = Field(
        default=None, description="Последняя дата тренировки в зале"
    )

    @field_validator("tags", "gallery_urls", mode="before")
    @classmethod
    def _json_lists(cls, v):
        if v is None:
            return []
        return v

    @field_validator("rating")
    @classmethod
    def _rating_out(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v < 1 or v > 5:
            raise ValueError("Оценка от 1 до 5")
        return v


class UserGymCreateResponse(UserGymOut, _Message):
    """Ответ POST после создания или нахождения существующей записи с тем же именем."""


class UserGymPatch(BaseModel):
    """Частичное обновление зала (PATCH)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=256)
    address: Optional[str] = Field(default=None, max_length=2048)
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    rating: Optional[int] = Field(default=None)
    review_text: Optional[str] = Field(default=None, max_length=4096)
    last_visited_at: Optional[datetime] = None
    tags: Optional[list[str]] = None
    gallery_urls: Optional[list[str]] = None

    @field_validator("rating")
    @classmethod
    def _rating_patch(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v < 1 or v > 5:
            raise ValueError("Оценка от 1 до 5")
        return v


# Вложение в другие ответы (тренировка)
class UserGymOutBrief(_Id):
    """Кратко id + name для поля user_gym в ответе тренировки."""

    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., max_length=256, description="Название зала")
