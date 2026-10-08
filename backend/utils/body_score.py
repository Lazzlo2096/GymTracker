"""Оценка тела (body_score) по весу и росту пользователя."""

from __future__ import annotations

OPTIMAL_BMI = 22.0
BMI_DEVIATION_PENALTY = 0.5


def body_score_from_weight_and_height(
    weight_kg: float, height_cm: int | None
) -> float | None:
    """
    Шкала 1.0–10.0: максимум при ИМТ ≈ 22, снижается при отклонении.
    Без роста в профиле — None (оценку не показываем).
    """
    if height_cm is None or height_cm <= 0:
        return None

    height_m = height_cm / 100.0
    bmi = weight_kg / (height_m * height_m)
    raw = 10.0 - abs(bmi - OPTIMAL_BMI) * BMI_DEVIATION_PENALTY
    return round(max(1.0, min(10.0, raw)), 1)
