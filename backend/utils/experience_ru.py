"""Подпись стажа пользователя по дате регистрации (для экрана профиля)."""

from __future__ import annotations

from datetime import datetime, timezone


def _ru_months(n: int) -> str:
    n = max(0, n)
    if n == 0:
        return "менее месяца"

    m10 = n % 10
    m100 = n % 100
    if m10 == 1 and m100 != 11:
        return f"{n} месяц"

    if 2 <= m10 <= 4 and not (12 <= m100 <= 14):
        return f"{n} месяца"

    return f"{n} месяцев"


def _ru_years(y: int) -> str:
    y = max(1, y)
    m10 = y % 10
    m100 = y % 100

    if m10 == 1 and m100 != 11:
        return f"{y} год"

    if 2 <= m10 <= 4 and not (12 <= m100 <= 14):
        return f"{y} года"

    return f"{y} лет"


def experience_label_from_created_at(created_at: datetime) -> str:
    """Человекочитаемый стаж: «8 месяцев», «2 года» и т.д."""
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    months = (now.year - created_at.year) * 12 + (now.month - created_at.month)
    if now.day < created_at.day:
        months -= 1

    months = max(0, months)
    if months < 12:
        return _ru_months(months)

    years = months // 12
    return _ru_years(years)
