"""Загрузка захардкоженных шаблонов тренировок (синхрон с mobile mockPlansData)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_MOCK_JSON_PATH = Path(__file__).resolve().parent / "mock" / "workout_templates.json"

_SUMMARY_KEYS = (
    "id",
    "title",
    "description",
    "gym_name",
    "exercises_count",
    "estimated_minutes",
    "last_used_label",
)


@lru_cache
def _load_all_details() -> list[dict[str, Any]]:
    raw = _MOCK_JSON_PATH.read_text(encoding="utf-8")
    payload = json.loads(raw)
    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError(f"{_MOCK_JSON_PATH}: ожидался объект с полем items: list")
    return items


def load_all_workout_template_seed_items() -> list[dict[str, Any]]:
    """Полные записи из JSON для сида в БД (dev/demo)."""
    return _load_all_details()


def list_mock_workout_template_summaries() -> list[dict[str, Any]]:
    """Краткие карточки для GET /workout_templates/."""
    return [{key: item[key] for key in _SUMMARY_KEYS} for item in _load_all_details()]


def get_mock_workout_template_detail(template_id: str) -> dict[str, Any] | None:
    """Полный шаблон для GET /workout_templates/{template_id}."""
    for item in _load_all_details():
        if item.get("id") == template_id:
            return item
    return None
