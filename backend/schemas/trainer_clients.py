"""Схемы для связей тренер ↔ подопечный."""

from pydantic import BaseModel, Field


class TrainerClientCreate(BaseModel):
    """Создание связи: тренер назначает подопечного."""

    client_id: int = Field(..., ge=1, description="users.id подопечного")
    trainer_id: int | None = Field(
        default=None,
        ge=1,
        description="users.id тренера (обязателен для admin, иначе берётся из токена)",
    )


class TrainerClientOut(BaseModel):
    """Одна строка trainer_clients."""

    id: int
    trainer_id: int
    client_id: int

    model_config = {"from_attributes": True}


class TrainerClientDeleteResponse(BaseModel):
    """Ответ DELETE связи тренер ↔ подопечный."""

    message: str = Field(default="ok", description="Краткий статус")
    id: int = Field(..., description="id удалённой строки trainer_clients")
