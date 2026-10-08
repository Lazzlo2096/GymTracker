"""Загрузка мока текущей программы пользователя."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from schemas.plans import ProgramOut, program_out_adapter

_MOCK_JSON_PATH = Path(__file__).resolve().parent / "mock" / "current_program.json"


@lru_cache
def _load_payload() -> dict[str, Any]:
    raw = _MOCK_JSON_PATH.read_text(encoding="utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError(f"{_MOCK_JSON_PATH}: ожидался объект JSON")
    return payload


def get_mock_current_program() -> ProgramOut:
    """Ответ GET /plans/program/current (dev/demo)."""
    return program_out_adapter.validate_python(_load_payload())
