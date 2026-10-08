"""Тесты weight_composition v1."""

from __future__ import annotations

import json
from pathlib import Path

from utils.weight_composition import (
    compute_weight_composition_caches,
    refresh_weight_composition_dict,
    resolve_weight_kg,
    resolve_weight_string,
    sum_plates_term_kg,
)

_EXAMPLE_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "weight_composition_v1.example.json"
)


def _load_example() -> dict:
    with _EXAMPLE_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def test_example_file_documents_bodyweight_plus_belt():
    entry = _load_example()
    composition = entry["weight_composition"]

    cached_kg, cached_display = compute_weight_composition_caches(composition)
    assert cached_kg == 87
    assert cached_display == "св. вес + пояс 9кг"


def test_resolve_prefers_explicit_weight_fields():
    entry = _load_example()
    assert resolve_weight_kg(entry) == 98
    assert resolve_weight_string(entry) == "св. вес + пояс 20"


def test_resolve_falls_back_to_composition_cache():
    entry = _load_example()
    entry = dict(entry)
    entry["weight_kg"] = None
    entry["weight_string"] = None

    assert resolve_weight_kg(entry) == 87
    assert resolve_weight_string(entry) == "св. вес + пояс 9кг"


def test_plates_mirror_doubles_sum():
    term = {"kind": "plates", "kgs": [10, 5], "mirror": True}
    assert sum_plates_term_kg(term) == 30


def test_bar_term_in_composition_cache():
    composition = {
        "version": 1,
        "terms": [
            {
                "kind": "bar",
                "bar_kg": 20,
                "meta": {"label": "олимпийский", "standard": "olympic_men"},
            },
            {
                "kind": "plates",
                "kgs": [20],
                "mirror": True,
                "meta": {"placement": "гриф"},
            },
        ],
    }
    cached_kg, cached_display = compute_weight_composition_caches(composition)
    assert cached_kg == 60
    assert cached_display == "олимпийский 20кг + гриф 40кг"


def test_refresh_updates_bodyweight_cache():
    composition = {
        "version": 1,
        "terms": [
            {"kind": "bodyweight", "source": "user_bodyweight_history"},
            {
                "kind": "plates",
                "kgs": [20],
                "mirror": False,
                "meta": {"placement": "пояс"},
            },
        ],
    }
    refreshed = refresh_weight_composition_dict(composition, bodyweight_kg=80)
    assert refreshed["cached_effective_kg"] == 100
    assert refreshed["cached_display"] == "св. вес + пояс 20кг"
    assert refreshed["terms"][0]["cached_bodyweight_kg"] == 80


def test_refresh_preserves_existing_bodyweight_snapshot():
    composition = {
        "version": 1,
        "terms": [
            {
                "kind": "bodyweight",
                "source": "user_bodyweight_history",
                "cached_bodyweight_kg": 72.6,
            },
        ],
    }
    refreshed = refresh_weight_composition_dict(composition, bodyweight_kg=74.3)
    assert refreshed["cached_effective_kg"] == 72.6
    assert refreshed["terms"][0]["cached_bodyweight_kg"] == 72.6


def test_refresh_skips_user_entered_bodyweight():
    composition = {
        "version": 1,
        "terms": [
            {
                "kind": "bodyweight",
                "source": "user_entered_now",
                "user_entered_bodyweight_kg": 75,
            },
            {
                "kind": "plates",
                "kgs": [10],
                "mirror": False,
                "meta": {"placement": "пояс"},
            },
        ],
    }
    refreshed = refresh_weight_composition_dict(composition, bodyweight_kg=80)
    assert refreshed["terms"][0]["user_entered_bodyweight_kg"] == 75
    assert "cached_bodyweight_kg" not in refreshed["terms"][0]
    assert refreshed["cached_effective_kg"] == 85
