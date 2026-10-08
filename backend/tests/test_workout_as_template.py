"""Юнит-тесты преобразования выполненной тренировки в шаблон."""

from __future__ import annotations

from datetime import date

import pytest

from schemas.planned_set_timeline import PlannedRestSetEntry, PlannedWorkoutSetEntry
from schemas.workout_template import WorkoutTemplate
from utils.workout_as_template import (
    count_planned_work_sets,
    exercise_to_template,
    log_entry_to_planned,
    sets_json_to_planned_timeline,
    workout_template_to_create_payload,
    workout_to_template,
)
from utils.workout_as_template import planned_sets_json_to_db

COMPLETED_WORKOUT = {
    "id": 157,
    "user_id": 35,
    "created_at": "2026-06-07T20:34:26.588231Z",
    "workout_date": "2026-06-09",
    "day_title": "Сбывшийся день ног",
    "note": None,
    "user_gym_id": None,
    "user_gym": None,
    "exercises": [
        {
            "id": 55,
            "exercise_in_catalog_id": 7,
            "workout_id": 157,
            "order_index": 0,
            "sets_json": [
                {
                    "type": "mark",
                    "mark_type": "start",
                    "datetime": "2026-06-07T20:35:34.090000Z",
                    "comment": None,
                },
                {
                    "type": "set",
                    "weight_kg": 7.0,
                    "weight_string": None,
                    "reps": 12,
                    "reps_string": None,
                    "comment": None,
                    "set_seconds": 40,
                    "heart_rate_right_after": None,
                    "rating": None,
                    "reached_failure": False,
                    "effort_level": None,
                },
                {
                    "type": "rest",
                    "rest_seconds": 150,
                    "comment": None,
                },
                {
                    "type": "set",
                    "weight_kg": 8.0,
                    "weight_string": None,
                    "reps": 12,
                    "reps_string": None,
                    "comment": None,
                    "set_seconds": 25,
                    "heart_rate_right_after": None,
                    "rating": None,
                    "reached_failure": False,
                    "effort_level": None,
                },
                {
                    "type": "mark",
                    "mark_type": "end",
                    "datetime": "2026-06-07T20:37:52.580000Z",
                    "comment": None,
                },
            ],
            "note": None,
            "is_active": False,
        },
    ],
}


def test_log_entry_to_planned_skips_marks_and_keeps_set_fields():
    planned = log_entry_to_planned(
        {"type": "set", "weight_kg": 7.0, "reps": 12, "set_seconds": 40}
    )
    assert isinstance(planned, PlannedWorkoutSetEntry)
    assert planned.weight_kg == 7.0
    assert planned.reps == 12
    assert not hasattr(planned, "set_seconds")

    assert log_entry_to_planned({"type": "mark", "mark_type": "start"}) is None


def test_sets_json_to_planned_timeline_example():
    sets_json = COMPLETED_WORKOUT["exercises"][0]["sets_json"]
    planned = sets_json_to_planned_timeline(sets_json)

    assert len(planned) == 3
    assert isinstance(planned[0], PlannedWorkoutSetEntry)
    assert planned[0].weight_kg == 7.0
    assert planned[0].reps == 12
    assert isinstance(planned[1], PlannedRestSetEntry)
    assert planned[1].rest_seconds == 150
    assert isinstance(planned[2], PlannedWorkoutSetEntry)
    assert planned[2].weight_kg == 8.0
    assert count_planned_work_sets(planned) == 2


def test_workout_to_template_defaults():
    template = workout_to_template(
        COMPLETED_WORKOUT,
        strip_ids=False,
        clear_created_at=True,
    )

    assert isinstance(template, WorkoutTemplate)
    assert template.id == 157
    assert template.user_id == 35
    assert template.created_at is None
    assert template.workout_date == date(2026, 6, 10)
    assert template.day_title == "повтор: Сбывшийся день ног"
    assert template.user_gym_id is None

    exercise = template.exercises[0]
    assert exercise.id == 55
    assert exercise.workout_id == 157
    assert exercise.exercise_in_catalog_id == 7
    assert exercise.sets_json == []
    assert len(exercise.planned_sets_json) == 3
    assert exercise.planned_sets_count is None


def test_workout_to_template_custom_date_and_title():
    template = workout_to_template(
        COMPLETED_WORKOUT,
        workout_date=date(2026, 6, 10),
        day_title="повтор: день ног",
        strip_ids=False,
    )
    assert template.workout_date == date(2026, 6, 10)
    assert template.day_title == "повтор: день ног"


def test_exercise_to_template_falls_back_to_planned_sets_count():
    exercise = exercise_to_template(
        {
            "order_index": 0,
            "workout_id": 1,
            "sets_json": [
                {
                    "type": "mark",
                    "mark_type": "start",
                    "datetime": "2026-06-07T12:00:00Z",
                },
            ],
            "planned_sets": 4,
        },
        strip_ids=True,
    )
    assert exercise.planned_sets_json == []
    assert exercise.planned_sets_count == 4


def test_workout_template_to_create_payload_maps_legacy_count():
    template = workout_to_template(
        {
            "workout_date": "2026-06-09",
            "exercises": [
                {
                    "workout_id": 1,
                    "order_index": 0,
                    "sets_json": [],
                    "planned_sets": 3,
                }
            ],
        }
    )
    payload = workout_template_to_create_payload(template)
    exercise = payload["exercises"][0]
    assert exercise["planned_sets_count"] == 3
    assert "planned_sets" not in exercise
    assert "planned_sets_json" not in exercise


def test_planned_sets_json_to_db_serializes_timeline():
    exercise = exercise_to_template(COMPLETED_WORKOUT["exercises"][0], strip_ids=True)
    planned_db = planned_sets_json_to_db(exercise.planned_sets_json)

    assert len(planned_db) == 3
    assert planned_db[0] == {"type": "set", "weight_kg": 7.0, "reps": 12}
    assert planned_db[1] == {"type": "rest", "rest_seconds": 150}
    assert planned_db[2] == {"type": "set", "weight_kg": 8.0, "reps": 12}


def test_workout_template_to_create_payload_prefers_planned_sets_json():
    template = workout_to_template(COMPLETED_WORKOUT)
    payload = workout_template_to_create_payload(template)
    exercise = payload["exercises"][0]
    assert len(exercise["planned_sets_json"]) == 3
    assert "planned_sets" not in exercise
    assert "planned_sets_count" not in exercise


@pytest.mark.parametrize(
    "empty_set",
    [
        {"type": "set"},
        {"type": "set", "weight_kg": None, "reps": None},
    ],
)
def test_log_entry_to_planned_skips_empty_sets(empty_set):
    assert log_entry_to_planned(empty_set) is None
