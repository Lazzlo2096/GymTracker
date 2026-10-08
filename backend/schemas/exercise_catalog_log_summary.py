"""Агрегаты по журналу подходов для экрана каталога упражнений."""

from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ExerciseLogStats(BaseModel):
    """Статистика по одному упражнению каталога из тренировочного журнала."""

    exercise_in_catalog_id: int = Field(
        ..., description="ID записи exercises_in_catalog"
    )
    total_sets: int = Field(
        0, ge=0, description="Число залогированных рабочих подходов"
    )
    best_weight_kg: Optional[float] = Field(
        default=None, description="Максимальный вес (кг)"
    )
    reps_min: Optional[int] = Field(default=None, ge=0)
    reps_max: Optional[int] = Field(default=None, ge=0)
    planned_sets_hint: Optional[int] = Field(
        default=None,
        ge=0,
        description="Подсказка по числу подходов (последнее ненулевое planned_sets в журнале)",
    )


class CatalogTotals(BaseModel):
    """Сводка по каталогу и журналу текущего пользователя."""

    total_exercises: int = Field(
        ..., ge=0, description="Записей в каталоге в области видимости"
    )
    total_sets: int = Field(0, ge=0, description="Всего рабочих подходов в журнале")
    max_weight_kg: Optional[float] = Field(
        default=None, description="Макс. вес среди всех подходов"
    )
    tonnage_kg: float = Field(
        0, ge=0, description="Сумма вес×повторы (кг), только где оба заданы"
    )


class CatalogLogSummaryOut(BaseModel):
    """Ответ GET /exercises_in_catalog/log_summary."""

    totals: CatalogTotals
    by_exercise: list[ExerciseLogStats] = Field(default_factory=list)


class CatalogExerciseSetHistoryDay(BaseModel):
    """Один день истории подходов по упражнению каталога."""

    workout_date: date = Field(..., description="Дата тренировки")
    workout_ids: list[int] = Field(default_factory=list)
    exercise_in_workout_ids: list[int] = Field(default_factory=list)
    sets_count: int = Field(0, ge=0, description="Рабочих подходов за день")
    reps_total: int = Field(0, ge=0, description="Всего повторений за день")
    tonnage_kg: float = Field(0, ge=0, description="Сумма вес×повторы за день")
    max_weight_kg: Optional[float] = Field(default=None, description="Макс. вес за день")


class CatalogExerciseSetHistoryPoint(BaseModel):
    """Один рабочий подход на графике истории упражнения."""

    type: Literal["set"] = "set"
    workout_date: date = Field(..., description="Дата тренировки")
    workout_id: int
    exercise_in_workout_id: int
    set_number: int = Field(..., ge=1, description="Номер рабочего подхода внутри упражнения")
    weight_kg: Optional[float] = Field(default=None, description="Вес подхода")
    weight_string: Optional[str] = Field(default=None, description="Текстовая подпись веса")
    weight_composition: Optional[dict[str, Any]] = Field(
        default=None,
        description="Структурированный состав веса",
    )
    reps: Optional[int] = Field(default=None, ge=0, description="Повторы подхода")
    reps_string: Optional[str] = Field(default=None, description="Текстовая подпись повторений")
    comment: Optional[str] = Field(default=None, description="Комментарий к подходу")
    set_seconds: Optional[int] = Field(default=None, ge=0, description="Длительность подхода")
    heart_rate_right_after: Optional[int] = Field(default=None, ge=0, description="Пульс после подхода")
    rating: Optional[int] = Field(default=None, ge=1, le=10, description="Оценка подхода")
    reached_failure: Optional[bool] = Field(default=None, description="Был ли отказ")
    effort_level: Optional[str] = Field(default=None, description="Субъективная нагрузка")


class CatalogExerciseSetHistoryOut(BaseModel):
    """Ответ GET /exercises_in_catalog/{id}/set_history."""

    exercise_in_catalog_id: int
    name: str
    total_days: int = Field(0, ge=0)
    total_sets: int = Field(0, ge=0)
    days: list[CatalogExerciseSetHistoryDay] = Field(default_factory=list)
    points: list[CatalogExerciseSetHistoryPoint] = Field(default_factory=list)
