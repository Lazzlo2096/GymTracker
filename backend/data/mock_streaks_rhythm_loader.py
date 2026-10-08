"""Загрузка мока блока «Серии и ритм» (синхрон с mobile mockStatsData)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from schemas.stats import StreaksRhythmOut

_MOCK_JSON_PATH = Path(__file__).resolve().parent / "mock" / "streaks_rhythm.json"


@lru_cache
def _load_payload() -> dict[str, Any]:
    raw = _MOCK_JSON_PATH.read_text(encoding="utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError(f"{_MOCK_JSON_PATH}: ожидался объект JSON")
    return payload


def get_mock_streaks_rhythm() -> StreaksRhythmOut:
    """Ответ GET /stats/streaks-rhythm (dev/demo)."""
    return StreaksRhythmOut.model_validate(_load_payload())
