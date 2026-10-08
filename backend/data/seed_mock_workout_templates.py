"""Генерирует backend/data/mock/workout_templates.json из встроенных мок-данных."""

from __future__ import annotations

import json
from pathlib import Path

# Синхронизировать с mobile/src/components/plans/mockPlansData.ts
ITEMS: list[dict] = [
    {
        "id": "tpl-chest-tri",
        "title": "Грудь + трицепс",
        "description": "Фокус на жимах, объём 20 подходов",
        "gym_name": "World Gym",
        "exercises_count": 5,
        "estimated_minutes": 68,
        "last_used_label": "2 дня назад",
        "note": "Разминка 5–7 мин на велотренажёре перед жимами.",
        "exercises": [
            {
                "id": "ex-1",
                "name": "Жим штанги лёжа",
                "muscle_group": "Грудь",
                "planned_sets": [
                    {"type": "set", "weight_kg": 60, "reps": 10},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 70, "reps": 8},
                    {"type": "rest", "rest_seconds": 120},
                    {"type": "set", "weight_kg": 75, "reps": 6},
                    {"type": "rest", "rest_seconds": 120},
                    {"type": "set", "weight_kg": 75, "reps": 6},
                ],
            },
            {
                "id": "ex-2",
                "name": "Жим гантелей на наклонной",
                "muscle_group": "Грудь",
                "planned_sets": [
                    {"type": "set", "weight_kg": 24, "reps": 10},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 26, "reps": 8},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 26, "reps": 8},
                ],
            },
            {
                "id": "ex-3",
                "name": "Разводка в кроссовере",
                "muscle_group": "Грудь",
                "planned_sets": [
                    {"type": "set", "weight_label": "12 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_label": "12 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_label": "12 кг", "reps": 12},
                ],
            },
            {
                "id": "ex-4",
                "name": "Французский жим",
                "muscle_group": "Трицепс",
                "planned_sets": [
                    {"type": "set", "weight_kg": 30, "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 32.5, "reps": 10},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 32.5, "reps": 10},
                ],
            },
            {
                "id": "ex-5",
                "name": "Разгибания на блоке",
                "muscle_group": "Трицепс",
                "note": "Суперсет с отжиманиями на брусьях — по желанию.",
                "planned_sets": [
                    {"type": "set", "weight_label": "25 кг", "reps": 15},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_label": "27.5 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_label": "27.5 кг", "reps": 12},
                ],
            },
        ],
    },
    {
        "id": "tpl-back-bi",
        "title": "Спина + бицепс",
        "description": "Тяги и горизонтальные, акцент на ширину",
        "gym_name": "Iron",
        "exercises_count": 6,
        "estimated_minutes": 72,
        "last_used_label": "5 дней назад",
        "exercises": [
            {
                "id": "ex-1",
                "name": "Подтягивания",
                "muscle_group": "Спина",
                "planned_sets": [
                    {"type": "set", "reps_label": "макс", "reps": 8},
                    {"type": "rest", "rest_seconds": 120},
                    {"type": "set", "reps": 7},
                    {"type": "rest", "rest_seconds": 120},
                    {"type": "set", "reps": 6},
                ],
            },
            {
                "id": "ex-2",
                "name": "Тяга верхнего блока",
                "muscle_group": "Спина",
                "planned_sets": [
                    {"type": "set", "weight_label": "50 кг", "reps": 10},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_label": "55 кг", "reps": 8},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_label": "55 кг", "reps": 8},
                ],
            },
            {
                "id": "ex-3",
                "name": "Тяга гантели в наклоне",
                "muscle_group": "Спина",
                "planned_sets": [
                    {"type": "set", "weight_kg": 32, "reps": 10},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 34, "reps": 8},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 34, "reps": 8},
                ],
            },
            {
                "id": "ex-4",
                "name": "Тяга горизонтального блока",
                "muscle_group": "Спина",
                "planned_sets": [
                    {"type": "set", "weight_label": "45 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_label": "50 кг", "reps": 10},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_label": "50 кг", "reps": 10},
                ],
            },
            {
                "id": "ex-5",
                "name": "Подъём штанги на бицепс",
                "muscle_group": "Бицепс",
                "planned_sets": [
                    {"type": "set", "weight_kg": 30, "reps": 10},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 32.5, "reps": 8},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 32.5, "reps": 8},
                ],
            },
            {
                "id": "ex-6",
                "name": "Молотки с гантелями",
                "muscle_group": "Бицепс",
                "planned_sets": [
                    {"type": "set", "weight_kg": 14, "reps": 12},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_kg": 16, "reps": 10},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_kg": 16, "reps": 10},
                ],
            },
        ],
    },
    {
        "id": "tpl-legs",
        "title": "Ноги (квадрицепс + ягодицы)",
        "description": "Присед + жим платформы, 4–5 подходов на ключевые",
        "gym_name": "World Gym",
        "exercises_count": 5,
        "estimated_minutes": 75,
        "last_used_label": "неделю назад",
        "exercises": [
            {
                "id": "ex-1",
                "name": "Приседания со штангой",
                "muscle_group": "Ноги",
                "planned_sets": [
                    {"type": "set", "weight_kg": 80, "reps": 8},
                    {"type": "rest", "rest_seconds": 150},
                    {"type": "set", "weight_kg": 90, "reps": 6},
                    {"type": "rest", "rest_seconds": 180},
                    {"type": "set", "weight_kg": 95, "reps": 5},
                    {"type": "rest", "rest_seconds": 180},
                    {"type": "set", "weight_kg": 95, "reps": 5},
                ],
            },
            {
                "id": "ex-2",
                "name": "Жим ногами",
                "muscle_group": "Ноги",
                "planned_sets": [
                    {"type": "set", "weight_label": "120 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 120},
                    {"type": "set", "weight_label": "140 кг", "reps": 10},
                    {"type": "rest", "rest_seconds": 120},
                    {"type": "set", "weight_label": "150 кг", "reps": 8},
                ],
            },
            {
                "id": "ex-3",
                "name": "Румынская тяга",
                "muscle_group": "Ноги",
                "planned_sets": [
                    {"type": "set", "weight_kg": 60, "reps": 10},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 70, "reps": 8},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 70, "reps": 8},
                ],
            },
            {
                "id": "ex-4",
                "name": "Разгибания ног",
                "muscle_group": "Ноги",
                "planned_sets": [
                    {"type": "set", "weight_label": "40 кг", "reps": 15},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_label": "45 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_label": "45 кг", "reps": 12},
                ],
            },
            {
                "id": "ex-5",
                "name": "Ягодичный мост",
                "muscle_group": "Ягодицы",
                "planned_sets": [
                    {"type": "set", "weight_kg": 60, "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 70, "reps": 10},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 70, "reps": 10},
                ],
            },
        ],
    },
    {
        "id": "tpl-shoulders",
        "title": "Плечи + трапеции",
        "description": "Жимы + махи, лёгкий акцент на заднюю дельту",
        "gym_name": None,
        "exercises_count": 5,
        "estimated_minutes": 52,
        "last_used_label": "3 дня назад",
        "exercises": [
            {
                "id": "ex-1",
                "name": "Жим штанги стоя",
                "muscle_group": "Плечи",
                "planned_sets": [
                    {"type": "set", "weight_kg": 40, "reps": 8},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 45, "reps": 6},
                    {"type": "rest", "rest_seconds": 90},
                    {"type": "set", "weight_kg": 45, "reps": 6},
                ],
            },
            {
                "id": "ex-2",
                "name": "Махи гантелей в стороны",
                "muscle_group": "Плечи",
                "planned_sets": [
                    {"type": "set", "weight_kg": 10, "reps": 15},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_kg": 12, "reps": 12},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_kg": 12, "reps": 12},
                ],
            },
            {
                "id": "ex-3",
                "name": "Обратные разведения",
                "muscle_group": "Плечи",
                "planned_sets": [
                    {"type": "set", "weight_label": "6 кг", "reps": 15},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_label": "8 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_label": "8 кг", "reps": 12},
                ],
            },
            {
                "id": "ex-4",
                "name": "Тяга штанги к подбородку",
                "muscle_group": "Трапеции",
                "planned_sets": [
                    {"type": "set", "weight_kg": 35, "reps": 10},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 40, "reps": 8},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 40, "reps": 8},
                ],
            },
            {
                "id": "ex-5",
                "name": "Шраги с гантелями",
                "muscle_group": "Трапеции",
                "planned_sets": [
                    {"type": "set", "weight_kg": 24, "reps": 12},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_kg": 28, "reps": 10},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "weight_kg": 28, "reps": 10},
                ],
            },
        ],
    },
    {
        "id": "tpl-mobility",
        "title": "Мобилити + лёгкая растяжка",
        "description": "20–25 минут, восстановление и подвижность",
        "gym_name": "Дома",
        "exercises_count": 4,
        "estimated_minutes": 24,
        "last_used_label": "вчера",
        "exercises": [
            {
                "id": "ex-1",
                "name": "Кошка-корова",
                "muscle_group": "Спина",
                "planned_sets": [
                    {"type": "set", "reps_label": "2 мин", "reps": None},
                    {"type": "rest", "rest_seconds": 30},
                    {"type": "set", "reps_label": "2 мин", "reps": None},
                ],
            },
            {
                "id": "ex-2",
                "name": "Выпады с ротацией",
                "muscle_group": "Ноги",
                "planned_sets": [
                    {"type": "set", "reps_label": "10/стор.", "reps": None},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "reps_label": "10/стор.", "reps": None},
                ],
            },
            {
                "id": "ex-3",
                "name": "Растяжка сгибателей бедра",
                "muscle_group": "Ноги",
                "planned_sets": [
                    {"type": "set", "reps_label": "90 с/стор.", "reps": None},
                    {"type": "rest", "rest_seconds": 20},
                    {"type": "set", "reps_label": "90 с/стор.", "reps": None},
                ],
            },
            {
                "id": "ex-4",
                "name": "Дыхательная растяжка грудного отдела",
                "muscle_group": "Грудь",
                "planned_sets": [
                    {"type": "set", "reps_label": "3 мин", "reps": None},
                    {"type": "rest", "rest_seconds": 30},
                    {"type": "set", "reps_label": "3 мин", "reps": None},
                ],
            },
        ],
    },
    {
        "id": "tpl-full-light",
        "title": "Full body (лёгкий)",
        "description": "Для активного восстановления или новичков",
        "gym_name": None,
        "exercises_count": 6,
        "estimated_minutes": 45,
        "last_used_label": "10 дней назад",
        "exercises": [
            {
                "id": "ex-1",
                "name": "Гоблет-присед",
                "muscle_group": "Ноги",
                "planned_sets": [
                    {"type": "set", "weight_kg": 16, "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 20, "reps": 10},
                ],
            },
            {
                "id": "ex-2",
                "name": "Отжимания",
                "muscle_group": "Грудь",
                "planned_sets": [
                    {"type": "set", "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "reps": 10},
                ],
            },
            {
                "id": "ex-3",
                "name": "Тяга блока сидя",
                "muscle_group": "Спина",
                "planned_sets": [
                    {"type": "set", "weight_label": "35 кг", "reps": 12},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_label": "40 кг", "reps": 10},
                ],
            },
            {
                "id": "ex-4",
                "name": "Жим гантелей сидя",
                "muscle_group": "Плечи",
                "planned_sets": [
                    {"type": "set", "weight_kg": 12, "reps": 10},
                    {"type": "rest", "rest_seconds": 60},
                    {"type": "set", "weight_kg": 14, "reps": 8},
                ],
            },
            {
                "id": "ex-5",
                "name": "Планка",
                "muscle_group": "Пресс",
                "planned_sets": [
                    {"type": "set", "reps_label": "45 с", "reps": None},
                    {"type": "rest", "rest_seconds": 45},
                    {"type": "set", "reps_label": "45 с", "reps": None},
                ],
            },
            {
                "id": "ex-6",
                "name": "Велотренажёр",
                "muscle_group": "Кардио",
                "planned_sets": [{"type": "set", "reps_label": "8 мин", "reps": None}],
            },
        ],
    },
]


def main() -> None:
    out = Path(__file__).resolve().parent / "mock" / "workout_templates.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"items": ITEMS}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
