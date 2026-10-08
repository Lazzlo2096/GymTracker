"""Тесты утилит и сида шаблонов тренировок."""

from __future__ import annotations

from data.mock_workout_templates_loader import (
    get_mock_workout_template_detail,
    list_mock_workout_template_summaries,
    load_all_workout_template_seed_items,
)
from schemas.workout_template_api import (
    WorkoutTemplateDetailOut,
    WorkoutTemplateListOut,
)
from utils.workout_template_planned_sets import (
    compute_planned_tonnage_kg,
    derive_uniform_all_fields,
    is_uniform_simple_planned,
    planned_sets_api_to_db,
    planned_sets_db_to_api,
)


def test_seed_json_list_non_empty() -> None:
    items = load_all_workout_template_seed_items()
    assert len(items) >= 1
    assert items[0].get("title")


def test_planned_sets_roundtrip_weight_label() -> None:
    api = [{"type": "set", "weight_kg": 60, "reps": 10, "weight_label": "60 кг"}]
    db = planned_sets_api_to_db(api)
    assert db[0]["weight_string"] == "60 кг"
    back = planned_sets_db_to_api(db)
    assert back[0]["weight_label"] == "60 кг"
    assert back[0]["weight_kg"] == 60


def test_mock_json_detail_maps_to_api_schema() -> None:
    raw = get_mock_workout_template_detail("tpl-chest-tri")
    assert raw is not None
    raw["id"] = 1
    raw["exercises"] = [
        {**ex, "id": i + 1, "exercise_in_catalog_id": i + 10}
        for i, ex in enumerate(raw.get("exercises") or [])
    ]
    detail = WorkoutTemplateDetailOut.model_validate(raw)
    assert detail.title == "Грудь + трицепс"
    assert len(detail.exercises) == 5
    assert detail.exercises[0].exercise_in_catalog_id == 10


def test_mock_summaries_validate_as_list_out() -> None:
    summaries = list_mock_workout_template_summaries()
    for item in summaries:
        item["id"] = 1
    payload = WorkoutTemplateListOut(
        items=[{**s, "id": i + 1} for i, s in enumerate(summaries)]
    )
    assert len(payload.items) >= 1


def test_uniform_plan_and_tonnage_helpers() -> None:
    uniform = [
        {"type": "set", "weight_kg": 50, "reps": 10},
        {"type": "rest", "rest_seconds": 90},
        {"type": "set", "weight_kg": 50, "reps": 10},
    ]
    assert is_uniform_simple_planned(uniform) is True
    assert compute_planned_tonnage_kg(uniform) == 1000.0
    reps, weight, rest = derive_uniform_all_fields(uniform)
    assert reps == 10
    assert weight == 50.0
    assert rest == 90

    custom = [
        {"type": "set", "weight_kg": 50, "reps": 10},
        {"type": "set", "weight_kg": 55, "reps": 8},
    ]
    assert is_uniform_simple_planned(custom) is False
    assert derive_uniform_all_fields(custom) == (None, None, None)
