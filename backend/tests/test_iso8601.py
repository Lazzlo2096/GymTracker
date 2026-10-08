"""Тесты парсера ISO 8601: hybrid / extended / basic."""

from datetime import datetime, timezone

import pytest

from utils.iso8601 import parse_iso8601_datetime


def test_parse_preferred_hybrid_with_z() -> None:
    dt = parse_iso8601_datetime("2026-07-05T210000Z")
    assert dt == datetime(2026, 7, 5, 21, 0, 0, tzinfo=timezone.utc)


def test_parse_preferred_hybrid_date_only() -> None:
    dt = parse_iso8601_datetime("2026-07-05")
    assert dt == datetime(2026, 7, 5, 0, 0, 0)


def test_parse_extended_with_z() -> None:
    dt = parse_iso8601_datetime("2026-05-01T07:20:00Z")
    assert dt == datetime(2026, 5, 1, 7, 20, 0, tzinfo=timezone.utc)


def test_parse_basic_with_z() -> None:
    dt = parse_iso8601_datetime("20260501T072000Z")
    assert dt == datetime(2026, 5, 1, 7, 20, 0, tzinfo=timezone.utc)


def test_parse_basic_date_only() -> None:
    dt = parse_iso8601_datetime("20260501")
    assert dt == datetime(2026, 5, 1, 0, 0, 0)


def test_parse_invalid() -> None:
    with pytest.raises(ValueError):
        parse_iso8601_datetime("not-a-date")
