"""Общие query-параметры для list-эндпоинтов API."""

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SortDirectionEnum(str, Enum):
    """Направление сортировки для list-эндпоинтов."""

    ASC = "asc"
    DESC = "desc"


class OutputSettings(BaseModel):
    """Параметры запроса для сортировки и пагинации списков."""

    sort_direction: SortDirectionEnum = Field(
        default=SortDirectionEnum.DESC, description="asc или desc"
    )
    sort_by: Optional[str] = Field(default=None, description="Имя поля для сортировки")
    limit: Optional[int] = Field(
        default=None, ge=1, le=500, description="Макс. число строк"
    )
    offset: Optional[int] = Field(default=None, ge=0, description="Смещение")


class CommonListQuery(BaseModel):
    """
    Общие query-параметры для list-эндпоинтов.

    `owner` — целый id пользователя-владельца, где это применимо.
    """

    owner: Optional[str] = Field(
        default=None,
        description="Целый id владельца (users.id), где поддерживается",
    )
    q: Optional[str] = Field(
        default=None, description="Подстрока поиска по текстовым полям сущности"
    )
    date_from: Optional[date] = Field(
        default=None, description="Нижняя граница даты (включительно)"
    )
    date_to: Optional[date] = Field(
        default=None, description="Верхняя граница даты (включительно)"
    )
