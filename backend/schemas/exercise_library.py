"""Схемы системного и публичного каталогов упражнений (TGL-33)."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from schemas.exercise_in_catalog import ExerciseInCatalogCreateResponse
from schemas.utils.common_parts import _Id


class ExerciseTemplateFields(BaseModel):
    """Общие поля шаблона упражнения (система / публичный каталог)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=128)
    notes: Optional[str] = None
    muscle_group: Optional[str] = Field(default=None, max_length=128)
    machine_location: Optional[str] = None
    machine_settings: Optional[dict] = None
    icon: Optional[str] = Field(default="barbell", max_length=64)
    image: Optional[str] = Field(default=None, max_length=4096)


class SystemExerciseOut(ExerciseTemplateFields, _Id):
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime


class SystemExerciseAdminCreate(ExerciseTemplateFields):
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class SystemExerciseAdminPatch(ExerciseTemplateFields):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class PublicExerciseOut(ExerciseTemplateFields, _Id):
    author_user_id: int
    source_catalog_id: Optional[int] = None
    is_active: bool = True
    published_at: datetime


class PublicExerciseAuthorBrief(BaseModel):
    id: int
    display_name: Optional[str] = None


class PublicExerciseOutWithAuthor(PublicExerciseOut):
    author: Optional[PublicExerciseAuthorBrief] = None


class PublishExerciseResponse(BaseModel):
    message: str = "Exercise published"
    public_exercise_id: int


class UnpublishExerciseResponse(BaseModel):
    status: Literal["unpublished"] = "unpublished"


class CopyToCatalogResponse(ExerciseInCatalogCreateResponse):
    """Ответ после копирования шаблона в личный каталог."""

    message: str = Field(default="Exercise copied to catalog")
