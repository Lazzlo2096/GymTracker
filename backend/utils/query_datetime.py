"""Общие query-параметры даты/времени для FastAPI (start / end)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import HTTPException, Query

from utils.iso8601 import parse_iso8601_datetime

PREFERRED_DT_EXAMPLE = "2026-07-05T210000Z"
PREFERRED_DT_HINT = (
    "Предпочтительно: 2026-07-05T210000Z "
    "(дата с `-`, время без `:`). Также extended / full basic."
)


def parse_query_datetime(raw: str | None, *, field: str) -> datetime | None:
    if raw is None:
        return None

    text = raw.strip()
    if not text:
        return None

    try:
        return parse_iso8601_datetime(text)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Некорректный {field}: ожидается ISO 8601 "
                f"({PREFERRED_DT_EXAMPLE} или 2026-07-05T21:00:00Z)"
            ),
        ) from None


StartQuery = Annotated[
    str | None,
    Query(
        description=f"Начало диапазона (включительно). {PREFERRED_DT_HINT}",
        examples=[PREFERRED_DT_EXAMPLE, "2026-07-05T000000Z"],
    ),
]

EndQuery = Annotated[
    str | None,
    Query(
        description=f"Конец диапазона (включительно). {PREFERRED_DT_HINT}",
        examples=["2026-08-05T235959Z", PREFERRED_DT_EXAMPLE],
    ),
]
