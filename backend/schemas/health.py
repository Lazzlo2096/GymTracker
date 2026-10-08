"""Ответ GET /api/v1/health (TGL-37)."""

from typing import Literal

from pydantic import BaseModel, Field

HealthStatus = Literal["ok", "degraded", "unhealthy"]
CheckStatus = Literal["ok", "error", "skipped"]


class HealthResources(BaseModel):
    """Нагрузка хоста (проценты)."""

    cpu_percent: float = Field(..., description="Загрузка CPU, %")
    memory_percent: float = Field(..., description="Использование RAM, %")
    disk_used_percent: float = Field(
        ..., description="Занято на диске (путь проверки), %"
    )
    disk_free_percent: float = Field(..., description="Свободно на диске, %")


class HealthChecks(BaseModel):
    postgres: CheckStatus
    redis: CheckStatus


class HealthResponse(BaseModel):
    status: HealthStatus
    service: str = "gymtracker-api"
    checks: HealthChecks
    resources: HealthResources
    warnings: list[str] = Field(default_factory=list)
