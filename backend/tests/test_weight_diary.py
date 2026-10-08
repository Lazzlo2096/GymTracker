"""Тесты дневника веса и body_score."""

from __future__ import annotations

from utils.body_score import body_score_from_weight_and_height


def test_body_score_optimal_bmi() -> None:
    # 80 кг, 190 см → ИМТ 22.16 → близко к 10
    assert body_score_from_weight_and_height(80.0, 190) == 9.9


def test_body_score_without_height_is_unavailable() -> None:
    assert body_score_from_weight_and_height(75.0, None) is None
    assert body_score_from_weight_and_height(75.0, 0) is None


def test_body_score_clamped_to_range() -> None:
    score = body_score_from_weight_and_height(120.0, 160)
    assert 1.0 <= score <= 10.0
