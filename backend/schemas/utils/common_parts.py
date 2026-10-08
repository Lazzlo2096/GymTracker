"""Переиспользуемые фрагменты Pydantic-схем (миксины, пагинация, стандартные ответы API)."""

from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, Field


class ApiMessage(BaseModel):
    """
    Минимальный JSON-ответ, когда тело сущности не возвращается.

    Используется вместо «пустого» HTTP 201/204, чтобы клиент всегда получал JSON.
    """

    message: str = Field(
        default="ok",
        description="Краткий статус операции (как правило «ok»)",
    )


class ApiMessageWithId(BaseModel):
    """Успешная операция с одним числовым идентификатором (например, удалённая связь)."""

    message: str = Field(default="ok", description="Краткий статус")
    id: int = Field(..., description="Идентификатор затронутой записи")


# Миксина
class _Id(BaseModel):
    """Идентификатор записи в БД."""

    id: int = Field(..., description="ID записи")


# Миксина
class _Row(_Id):
    """Поля строки с привязкой к пользователю и времени создания."""

    user_id: int = Field(..., description="ID пользователя")
    created_at: datetime = Field(..., description="Дата создания")


# Миксина
class _Message(BaseModel):
    """Текстовое сообщение об успешном завершении операции."""

    message: str = Field(..., description="Сообщение об успехе")


# Дженерик
T = TypeVar("T")


class PageResponse(BaseModel, Generic[T]):
    """Пагинированный список"""

    total: int = Field(..., ge=0)
    limit: int = Field(..., ge=1)
    offset: int = Field(..., ge=0)
    has_more: bool = Field(
        ..., description="True, если после этой страницы есть ещё записи"
    )
    items: list[T]
