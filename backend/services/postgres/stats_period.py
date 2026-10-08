"""Период статистики (/stats): границы окон, подписи, вывод вида из start/end."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from schemas.stats import StatsBucketId, StatsPeriodId

STATS_PERIOD_LABELS_RU: dict[StatsPeriodId, str] = {
    "7d": "7 дней",
    "30d": "30 дней",
    "3m": "3 месяца",
    "year": "Год",
    "all": "Всё время",
}


def default_bucket_for_period(period: StatsPeriodId) -> StatsBucketId:
    """Квант серии, если query bucket не передан (как раньше по чипам)."""
    if period == "7d":
        return "day"
    if period == "30d":
        return "week"
    if period in ("3m", "year"):
        return "month"
    return "year"


def resolve_stats_period_bounds(
    period: StatsPeriodId,
    today: date,
) -> tuple[date | None, date | None]:
    """Как mobile getStatsPeriodDateRange: (start, end), для all → (None, None)."""
    if period == "all":
        return None, None

    end = today
    if period == "7d":
        start = today - timedelta(days=7)
    elif period == "30d":
        start = today - timedelta(days=30)
    elif period == "3m":
        month = today.month - 3
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        day = min(today.day, _days_in_month(year, month))
        start = date(year, month, day)
    else:  # year
        try:
            start = date(today.year - 1, today.month, today.day)
        except ValueError:
            start = date(today.year - 1, today.month, 28)
    return start, end


def previous_stats_period_bounds(
    period: StatsPeriodId,
    today: date,
) -> tuple[date | None, date | None]:
    """Предыдущее окно той же длины (для дельт). Для all — нет сравнения."""
    start, end = resolve_stats_period_bounds(period, today)
    if start is None or end is None:
        return None, None

    return previous_bounds_from_range(start, end)


def previous_bounds_from_range(
    date_from: date,
    date_to: date,
) -> tuple[date, date]:
    """Предыдущее окно той же длины непосредственно перед date_from."""
    length_days = (date_to - date_from).days + 1
    prev_end = date_from - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length_days - 1)
    return prev_start, prev_end


def date_bounds_from_datetimes(
    start: datetime | None,
    end: datetime | None,
) -> tuple[date | None, date | None]:
    """Календарные границы фильтра по workout_date из query start/end."""
    date_from = start.date() if start is not None else None
    date_to = end.date() if end is not None else None
    return date_from, date_to


def infer_stats_period_id(
    date_from: date | None,
    date_to: date | None,
) -> StatsPeriodId:
    """
    Вид бакетов/подписи по длине окна.
    Оба None → all; иначе по числу дней между границами.
    """
    if date_from is None and date_to is None:
        return "all"
    if date_from is None or date_to is None:
        return "all"

    days = (date_to - date_from).days
    if days <= 8:
        return "7d"
    if days <= 35:
        return "30d"
    if days <= 100:
        return "3m"
    if days <= 400:
        return "year"
    return "all"


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        nxt = date(year + 1, 1, 1)
    else:
        nxt = date(year, month + 1, 1)
    return (nxt - timedelta(days=1)).day
