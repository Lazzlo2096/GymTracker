"""
По свободному названию тренировки/упражнения подбирает ключ иконки каталога
(совпадает с ключами в mobile/src/components/exercise/ExerciseGlyph.tsx → GLYPH_MAP).
"""

import re

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/suggestions", tags=["suggestions"])

_VALID_ICONS: frozenset[str] = frozenset(
    {
        "barbell",
        "dumbbell",
        "biceps",
        "pulldown",
        "squat",
        "bench",
        "shoulder",
        "deadlift",
        "kettlebell",
        "cable",
        "cardio",
        "abs",
    }
)


class SuggestWorkoutIconRequest(BaseModel):
    """Название тренировки или упражнения, как ввёл пользователь."""

    name: str = Field(..., min_length=1, max_length=500, description="Свободный текст")


class SuggestWorkoutIconResponse(BaseModel):
    """Ключ иконки для UI (каталог / ExerciseGlyph)."""

    icon: str = Field(..., description="Ключ иконки: barbell, squat, …")


def _normalize(s: str) -> str:
    s = s.casefold().strip()
    s = re.sub(r"\s+", " ", s)
    return s


def _suggest_icon(workout_name: str) -> str:
    """
    Упрощённая эвристика по подстрокам (ru/en). Порядок: от более специфичных к общим.
    """
    default_icon = "barbell"

    workout_name_normalized = _normalize(workout_name)
    if not workout_name_normalized:
        return default_icon

    rules: list[tuple[tuple[str, ...], str]] = [
        (("присед", "squat", "ноги", "leg"), "squat"),
        (("жим лёжа", "bench", "груд", "chest", "pectoral"), "bench"),
        (("мёртв", "deadlift", "сумо", "роман", "conventional"), "deadlift"),
        (
            ("подтяг", "pull-up", "pullup", "лат", "wide grip", "pulldown", "турник"),
            "pulldown",
        ),
        (
            ("плеч", "shoulder", "арм", "delt", "overhead", "arnold", "lateral"),
            "shoulder",
        ),
        (("бицеп", "biceps", "curl", "молот", "молоток"), "biceps"),
        (("гантел", "dumbbell", "разводка гант"), "dumbbell"),
        (("гир", "kettlebell", "свинг"), "kettlebell"),
        (("кроссовер", "кросс", "cable", "трос", "тросов"), "cable"),
        (
            ("кардио", "cardio", "бег", "вело", "эрг", "rower", "элипс", "tread"),
            "cardio",
        ),
        (("пресс", "abs", "кор", "plank", "планк", "крут"), "abs"),
    ]
    for keywords, icon in rules:
        if any(keyword in workout_name_normalized for keyword in keywords):
            if icon not in _VALID_ICONS:
                return default_icon
            return icon

    return default_icon


@router.post(
    "/suggest-workout-icon",
    response_model=SuggestWorkoutIconResponse,
    summary="Иконка по названию тренировки/упражнения",
    description=(
        "Принимает произвольное название и возвращает ключ иконки каталога "
        "(barbell, squat, …), согласованный с мобильным GLYPH_MAP. Без БД, только эвристика."
    ),
)
def suggest_workout_icon(body: SuggestWorkoutIconRequest) -> SuggestWorkoutIconResponse:
    workout_name = body.name
    icon = _suggest_icon(workout_name)

    return SuggestWorkoutIconResponse(icon=icon)
