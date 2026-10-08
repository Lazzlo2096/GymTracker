"""Unit-тесты расчёта длительности и is_active тренировки."""

from __future__ import annotations

from datetime import datetime, timezone

from utils.workout_duration import (
    compute_workout_duration_minutes,
    is_exercise_active,
    is_workout_active,
    is_workout_duration_in_progress,
)


def _mark(mark_type: str, iso: str) -> dict:
    return {"type": "mark", "mark_type": mark_type, "datetime": iso}


def test_duration_finished_workout() -> None:
    exercises = [
        {
            "order_index": 0,
            "sets_json": [_mark("start", "2025-03-12T18:00:00+00:00")],
        },
        {
            "order_index": 1,
            "sets_json": [_mark("end", "2025-03-12T19:30:00+00:00")],
        },
    ]
    assert compute_workout_duration_minutes(exercises) == 90
    assert is_workout_duration_in_progress(exercises) is False


def test_duration_in_progress_uses_now() -> None:
    exercises = [
        {
            "order_index": 0,
            "sets_json": [_mark("start", "2025-03-12T18:00:00+00:00")],
        },
        {"order_index": 1, "sets_json": []},
    ]
    now = datetime(2025, 3, 12, 18, 45, tzinfo=timezone.utc)
    assert compute_workout_duration_minutes(exercises, now=now) == 45
    assert is_workout_duration_in_progress(exercises) is True


def test_duration_without_start_returns_none() -> None:
    exercises = [
        {"order_index": 0, "sets_json": [_mark("end", "2025-03-12T19:00:00+00:00")]}
    ]
    assert compute_workout_duration_minutes(exercises) is None
    assert is_workout_duration_in_progress(exercises) is False


def test_exercise_is_active_open_session() -> None:
    exercise = {
        "sets_json": [
            _mark("start", "2025-03-12T18:00:00+00:00"),
            {"type": "set", "reps": 10},
        ],
    }
    assert is_exercise_active(exercise) is True
    assert is_workout_active([exercise]) is True


def test_exercise_is_active_closed_session() -> None:
    exercise = {
        "sets_json": [
            _mark("start", "2025-03-12T18:00:00+00:00"),
            _mark("end", "2025-03-12T18:45:00+00:00"),
        ],
    }
    assert is_exercise_active(exercise) is False
    assert is_workout_active([exercise]) is False


def test_workout_is_active_if_any_exercise_active() -> None:
    exercises = [
        {
            "order_index": 0,
            "sets_json": [
                _mark("start", "2025-03-12T18:00:00+00:00"),
                _mark("end", "2025-03-12T18:30:00+00:00"),
            ],
        },
        {
            "order_index": 1,
            "sets_json": [_mark("start", "2025-03-12T18:35:00+00:00")],
        },
    ]
    assert is_workout_active(exercises) is True
    assert is_exercise_active(exercises[0]) is False
    assert is_exercise_active(exercises[1]) is True
