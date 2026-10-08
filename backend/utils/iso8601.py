"""Парсинг даты/времени ISO 8601 для query-параметров API.

Предпочтительный формат (договорённость проекта):
  `2026-07-05T210000Z` — дата с дефисами, время без `:`.

Также принимаются:
  - extended: `2026-07-05T21:00:00Z`
  - full basic: `20260705T210000Z`
  - только дата: `2026-07-05` / `20260705`
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

# 2026-07-05 / 2026-07-05T210000 / 2026-07-05T210000Z / +0300
_HYBRID_DT_RE = re.compile(
    r"^"
    r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})"
    r"(?:T"
    r"(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
    r"(?:\.(?P<fraction>\d{1,6}))?"
    r")?"
    r"(?:(?P<zulu>Z)|(?P<sign>[+-])(?P<off_h>\d{2}):?(?P<off_m>\d{2}))?"
    r"$"
)

# 20260501 / 20260501T072000 / 20260501T072000Z / 20260501T072000+0300
_BASIC_DT_RE = re.compile(
    r"^"
    r"(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})"
    r"(?:T"
    r"(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
    r"(?:\.(?P<fraction>\d{1,6}))?"
    r")?"
    r"(?:(?P<zulu>Z)|(?P<sign>[+-])(?P<off_h>\d{2}):?(?P<off_m>\d{2}))?"
    r"$"
)


def parse_iso8601_datetime(value: str) -> datetime:
    """
    Принимает предпочтительный hybrid (`2026-07-05T210000Z`),
    extended (`2026-05-01T07:20:00Z`) и full basic (`20260501T072000Z`).
    """
    raw = value.strip()
    if not raw:
        raise ValueError("пустая дата/время")

    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        pass

    for pattern in (_HYBRID_DT_RE, _BASIC_DT_RE):
        match = pattern.fullmatch(raw)
        if match is not None:
            return _datetime_from_parts(match.groupdict())

    raise ValueError(f"не ISO 8601: {value!r}")


def _datetime_from_parts(parts: dict[str, str | None]) -> datetime:
    fraction = parts["fraction"]
    microsecond = int(fraction.ljust(6, "0")) if fraction else 0

    hour = int(parts["hour"] or 0)
    minute = int(parts["minute"] or 0)
    second = int(parts["second"] or 0)

    dt = datetime(
        int(parts["year"]),
        int(parts["month"]),
        int(parts["day"]),
        hour,
        minute,
        second,
        microsecond,
    )

    if parts["zulu"]:
        return dt.replace(tzinfo=timezone.utc)

    if parts["sign"]:
        offset = timedelta(
            hours=int(parts["off_h"]),
            minutes=int(parts["off_m"]),
        )
        if parts["sign"] == "-":
            offset = -offset
        return dt.replace(tzinfo=timezone(offset))

    return dt
