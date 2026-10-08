"""Сборка ответа health check."""

from __future__ import annotations

from schemas.health import HealthChecks, HealthResources, HealthResponse, HealthStatus
from services.health.metrics import collect_resource_metrics, disk_warnings
from services.health.probes import probe_postgres, probe_redis


async def build_health_response() -> HealthResponse:
    metrics = collect_resource_metrics()
    postgres = await probe_postgres()
    redis = await probe_redis()
    warnings = disk_warnings(metrics["disk_used_percent"])

    checks = HealthChecks(postgres=postgres, redis=redis)

    if postgres != "ok" or redis != "ok":
        status: HealthStatus = "unhealthy"
    elif warnings:
        status = "degraded"
    else:
        status = "ok"

    return HealthResponse(
        status=status,
        checks=checks,
        resources=HealthResources(**metrics),
        warnings=warnings,
    )


def http_status_for(health: HealthResponse) -> int:
    if health.status == "unhealthy":
        return 503
    return 200
