"""Загрузка мока каталога программ тренировок."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from schemas.plans import ProgramOut, program_out_adapter

_MOCK_JSON_PATH = Path(__file__).resolve().parent / "mock" / "programs.json"


@lru_cache
def _load_payload() -> list[dict[str, Any]]:
    raw = _MOCK_JSON_PATH.read_text(encoding="utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, list):
        raise ValueError(f"{_MOCK_JSON_PATH}: ожидался массив JSON")
    return payload


def get_mock_programs() -> list[ProgramOut]:
    """Ответ GET /plans/program (dev/demo)."""
    return [program_out_adapter.validate_python(item) for item in _load_payload()]
