"""Сбор метрик CPU/RAM/диска для health check (TGL-37)."""

from __future__ import annotations

from pathlib import Path

import psutil

from project_config import settings


def _disk_check_path() -> str:
    configured = (settings.HEALTH_DISK_PATH or "").strip()
    if configured:
        return configured
    media = Path(settings.MEDIA_ROOT)
    try:
        media.mkdir(parents=True, exist_ok=True)
        return str(media.resolve())
    except OSError:
        return "/"


def collect_resource_metrics() -> dict[str, float]:
    """Проценты CPU, RAM и диска (used + free = 100 для диска)."""
    cpu = float(psutil.cpu_percent(interval=0.1))
    mem = float(psutil.virtual_memory().percent)
    disk = psutil.disk_usage(_disk_check_path())
    used = float(disk.percent)
    free = max(0.0, 100.0 - used)
    return {
        "cpu_percent": round(cpu, 1),
        "memory_percent": round(mem, 1),
        "disk_used_percent": round(used, 1),
        "disk_free_percent": round(free, 1),
    }


def disk_warnings(disk_used_percent: float) -> list[str]:
    warnings: list[str] = []
    if disk_used_percent >= settings.HEALTH_DISK_CRITICAL_PERCENT:
        warnings.append("disk_space_critical")
    elif disk_used_percent >= settings.HEALTH_DISK_WARN_PERCENT:
        warnings.append("disk_space_low")
    return warnings
