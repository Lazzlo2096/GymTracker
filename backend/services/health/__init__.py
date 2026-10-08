"""Health check: метрики хоста и доступность зависимостей."""

from services.health.runner import build_health_response

__all__ = ["build_health_response"]
