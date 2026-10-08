"""Тип/характер упражнения в каталоге (TGL-36)."""

from enum import StrEnum


class ExerciseType(StrEnum):
    CARDIO = "cardio"
    STRENGTH = "strength"
    STRETCHING = "stretching"
    MOBILITY = "mobility"
    YOGA = "yoga"
    OTHER = "other"


EXERCISE_TYPE_LABELS_RU: dict[ExerciseType, str] = {
    ExerciseType.CARDIO: "Кардио",
    ExerciseType.STRENGTH: "Силовая",
    ExerciseType.STRETCHING: "Растяжка",
    ExerciseType.MOBILITY: "Мобилити",
    ExerciseType.YOGA: "Йога",
    ExerciseType.OTHER: "Другое",
}


def exercise_type_label_ru(value: str | ExerciseType | None) -> str | None:
    if value is None or value == "":
        return None
    try:
        return EXERCISE_TYPE_LABELS_RU[ExerciseType(str(value))]
    except ValueError:
        return None
