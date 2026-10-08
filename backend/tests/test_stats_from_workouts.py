"""Юнит-тесты расчёта серий и heatmap из дат тренировок."""

from datetime import date

from services.postgres.stats_actions import (
    build_activity_heatmap_from_rows,
    compute_best_streaks,
    compute_current_streak_days,
    intensity_for_exercise_count,
)


def test_intensity_thresholds() -> None:
    assert intensity_for_exercise_count(0) == 1
    assert intensity_for_exercise_count(3) == 1
    assert intensity_for_exercise_count(4) == 2


def test_current_streak_includes_today_when_trained() -> None:
    today = date(2026, 8, 5)
    active = {
        date(2026, 8, 3),
        date(2026, 8, 4),
        date(2026, 8, 5),
    }
    assert compute_current_streak_days(active, today) == 3


def test_current_streak_from_yesterday_if_no_today() -> None:
    today = date(2026, 8, 5)
    active = {date(2026, 8, 3), date(2026, 8, 4)}
    assert compute_current_streak_days(active, today) == 2


def test_current_streak_broken() -> None:
    today = date(2026, 8, 5)
    active = {date(2026, 8, 1), date(2026, 8, 2)}
    assert compute_current_streak_days(active, today) == 0


def test_best_streaks_sorted_by_length() -> None:
    active = {
        date(2026, 1, 1),
        date(2026, 1, 2),
        date(2026, 1, 3),
        date(2026, 2, 10),
        date(2026, 2, 11),
        date(2026, 3, 1),
    }
    best = compute_best_streaks(active, limit=5)
    assert len(best) == 3
    assert best[0].days == 3
    assert best[0].start == date(2026, 1, 1)
    assert best[0].end == date(2026, 1, 3)
    assert best[1].days == 2
    assert best[2].days == 1


def test_heatmap_builds_days_with_notes_and_intensity() -> None:
    rows = [
        (1, date(2026, 4, 1), "утро", 2),
        (2, date(2026, 4, 1), "вечер сильнее", 3),
        (3, date(2026, 4, 2), None, 1),
        (4, date(2026, 4, 3), "  ", 5),
    ]
    out = build_activity_heatmap_from_rows(
        rows,
        range_start=date(2026, 4, 1),
        range_end=date(2026, 4, 30),
    )
    assert out.range.start == date(2026, 4, 1)
    assert out.days["2026-04-01"].intensity == 2  # 2+3 упражнений
    assert out.days["2026-04-01"].note == "вечер сильнее"
    assert out.days["2026-04-02"].intensity == 1
    assert out.days["2026-04-02"].note is None
    assert out.days["2026-04-03"].intensity == 2
    assert out.days["2026-04-03"].note is None
