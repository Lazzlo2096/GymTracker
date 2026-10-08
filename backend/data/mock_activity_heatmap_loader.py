"""Загрузка мока календаря активности."""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

from schemas.stats import ActivityHeatmapOut, ActivityHeatmapRangeOut

_MOCK_JSON_PATH = Path(__file__).resolve().parent / "mock" / "activity_heatmap.json"


@lru_cache
def _load_payload() -> dict[str, Any]:
    raw = _MOCK_JSON_PATH.read_text(encoding="utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError(f"{_MOCK_JSON_PATH}: ожидался объект JSON")
    return payload


def _parse_iso_day(value: str) -> date:
    return date.fromisoformat(value[:10])


def _filter_activity_heatmap(
    payload: ActivityHeatmapOut,
    *,
    date_from: date | None,
    date_to: date | None,
) -> ActivityHeatmapOut:
    range_start = date_from if date_from is not None else payload.range.start
    range_end = date_to if date_to is not None else payload.range.end

    days = {
        day: value
        for day, value in payload.days.items()
        if range_start <= _parse_iso_day(day) <= range_end
    }

    return ActivityHeatmapOut(
        range=ActivityHeatmapRangeOut(start=range_start, end=range_end),
        days=days,
    )


def get_mock_activity_heatmap(
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> ActivityHeatmapOut:
    """Ответ GET /stats/activity-heatmap (dev/demo)."""
    payload = ActivityHeatmapOut.model_validate(_load_payload())
    if date_from is None and date_to is None:
        return payload
    return _filter_activity_heatmap(payload, date_from=date_from, date_to=date_to)
