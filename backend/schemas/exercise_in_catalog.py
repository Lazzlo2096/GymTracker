"""Схемы для эндпоинтов каталога упражнений (PostgreSQL)."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from schemas.exercise_type import ExerciseType
from schemas.user_gym import UserGymOutBrief
from schemas.utils.common_parts import _Message, _Row, PageResponse


class ExerciseInCatalogScheme(BaseModel):
    """Схема упражнения в каталоге."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        ..., min_length=1, max_length=128, description="Название упражнения"
    )
    notes: Optional[str] = Field(default=None, description="Заметки")
    muscle_group: Optional[str] = Field(default=None, description="Группа мышц")
    exercise_type: Optional[ExerciseType] = Field(
        default=None,
        description="Тип: cardio, strength, stretching, mobility, yoga, other",
    )
    machine_location: Optional[str] = Field(
        default=None, description="Где стоит тренажер в зале"
    )
    machine_settings: Optional[dict] = Field(
        default=None, description="Пользовательские настройки тренажера"
    )
    icon: Optional[str] = Field(default="barbell", description="Ключ иконки")
    image: Optional[str] = Field(
        default=None, max_length=4096, description="URL или путь к изображению"
    )


class ExerciseInCatalogCreate(ExerciseInCatalogScheme):
    """Схема создания упражнения в каталоге."""


class ExerciseInCatalogCreateResponse(ExerciseInCatalogScheme, _Row, _Message):
    """Ответ после создания упражнения в каталоге."""


class ExerciseInCatalogReplace(ExerciseInCatalogScheme):
    """Схема обновления упражнения в каталоге (полная замена полей записи)"""


class ExerciseInCatalogReplaceResponse(BaseModel):
    """Ответ PUT после полной замены."""

    status: Literal["updated"] = Field(default="updated", description="Статус операции")


class ExerciseInCatalogPatch(ExerciseInCatalogScheme):
    """Тело PATCH: частичное обновление (только переданные поля)."""

    name: Optional[str] = Field(
        default=None, min_length=1, max_length=128, description="Название"
    )
    icon: Optional[str] = Field(
        default=None, description="Ключ иконки"
    )
    user_gym_id: Optional[int] = Field(
        default=None, description="Фитнес-зал пользователя (user_gyms.id)"
    )


class ExerciseInCatalogPatchResponse(BaseModel):
    """Ответ PATCH после частичного обновления."""

    status: Literal["updated"] = Field(default="updated", description="Статус операции")


class ExerciseInCatalogOut(ExerciseInCatalogScheme, _Row):
    """Одна запись каталога (GET список / GET по id)."""

    model_config = ConfigDict(from_attributes=True)

    user_gym_id: Optional[int] = Field(
        default=None, description="Фитнес-зал пользователя (user_gyms.id)"
    )
    user_gym: Optional[UserGymOutBrief] = Field(
        default=None, description="Связанный фитнес-зал"
    )


class ExerciseInCatalogOutPaginatedList(PageResponse[ExerciseInCatalogOut]):
    pass


class ExerciseInCatalogDeleteResponse(BaseModel):
    """Ответ DELETE."""

    status: Literal["deleted"] = Field(default="deleted", description="Статус операции")


class ExerciseInCatalogImageUploadResponse(BaseModel):
    """Ответ POST загрузки изображения упражнения (multipart)."""

    message: str = Field(default="ok", description="Краткий статус")
    image: str = Field(..., description="URL сохранённого файла (префикс /media/...)")


class ExerciseInCatalogImageDeleteResponse(BaseModel):
    """Ответ DELETE изображения упражнения."""

    message: str = Field(default="ok", description="Краткий статус")
    status: Literal["deleted"] = Field(default="deleted", description="Статус операции")
