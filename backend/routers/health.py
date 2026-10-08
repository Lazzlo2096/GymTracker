"""Health check API (TGL-37): доступность сервиса, зависимостей и ресурсов хоста."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from cache_groups import CacheGroup, mark_cache_group

from schemas.health import HealthResponse
from services.health import build_health_response
from services.health.runner import http_status_for

router = APIRouter(prefix="/health", tags=["health"])


@router.get(
    "",
    response_model=HealthResponse,
    summary="Проверка живости API и ресурсов",
    description=(
        "Без авторизации. Возвращает статус ok/degraded/unhealthy, "
        "доступность PostgreSQL и Redis, загрузку CPU/RAM/диска (в процентах). "
        "HTTP 503 — сервис или критичные зависимости недоступны."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def health_check() -> JSONResponse:
    body = await build_health_response()
    return JSONResponse(
        status_code=http_status_for(body),
        content=body.model_dump(),
    )
