"""Схемы экрана статистики."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

StatsPeriodId = Literal["7d", "30d", "3m", "year", "all"]
StatsBucketId = Literal["day", "week", "month", "quarter", "year"]


class ActivityHeatmapRangeOut(BaseModel):
    """Диапазон дат календаря активности."""

    start: date = Field(..., description="Первая дата сетки (YYYY-MM-DD)")
    end: date = Field(..., description="Последняя дата сетки (YYYY-MM-DD)")


class ActivityHeatmapDayOut(BaseModel):
    """Один активный день в heatmap."""

    intensity: Literal[1, 2] = Field(
        ...,
        description="1 — до 3 упражнений за день, 2 — 4 и больше",
    )
    note: Optional[str] = Field(
        default=None,
        description="Комментарий к тренировке (если есть)",
    )


class ActivityHeatmapOut(BaseModel):
    """Ответ GET /stats/activity-heatmap."""

    range: ActivityHeatmapRangeOut
    days: dict[str, ActivityHeatmapDayOut] = Field(
        default_factory=dict,
        description="Дата (YYYY-MM-DD) → день с intensity и optional note",
    )


class BestStreakOut(BaseModel):
    """Одна запись в списке лучших серий."""

    start: date = Field(..., description="Дата начала (календарный день, YYYY-MM-DD)")
    end: date = Field(..., description="Дата окончания (календарный день, YYYY-MM-DD)")
    days: int = Field(..., ge=1, description="Длина серии в днях")


class StreaksRhythmOut(BaseModel):
    """Ответ GET /stats/streaks-rhythm."""

    current_streak_days: int = Field(
        ..., ge=0, description="Текущая серия тренировок, дней"
    )
    best_streaks: list[BestStreakOut] = Field(default_factory=list)


class StatsChartPointOut(BaseModel):
    """Точка столбчатой диаграммы динамики."""

    label: str
    sublabel: Optional[str] = None
    value: float = Field(..., ge=0)


class StatsKpiOut(BaseModel):
    """KPI-карточки за период."""

    workouts: int = Field(..., ge=0)
    duration_minutes: int = Field(..., ge=0)
    tonnage_kg: float = Field(..., ge=0)
    exercises: int = Field(..., ge=0)
    delta_workouts: str
    delta_duration: str
    delta_tonnage: str
    delta_exercises: str


class StatsOverviewOut(BaseModel):
    """KPI + серии метрик за период."""

    period: StatsPeriodId
    period_label: str
    bucket: StatsBucketId = Field(
        ...,
        description="Квант оси X: day | week | month | quarter | year",
    )
    kpi: StatsKpiOut
    series: dict[str, list[StatsChartPointOut]] = Field(
        ...,
        description="Ключи: sessions, duration, tonnage, exercises",
    )


class StatsTopExerciseOut(BaseModel):
    id: int
    name: str
    sets: int = Field(..., ge=0)
    tonnage_kg: float = Field(..., ge=0)
    best_weight_kg: float = Field(..., ge=0)


class StatsTopExercisesOut(BaseModel):
    period: StatsPeriodId
    items: list[StatsTopExerciseOut] = Field(default_factory=list)


class StatsGymVisitOut(BaseModel):
    id: int
    name: str
    visit_count: int = Field(..., ge=0)
    last_workout_date: Optional[date] = None


class StatsGymVisitsOut(BaseModel):
    period: StatsPeriodId
    items: list[StatsGymVisitOut] = Field(default_factory=list)


class StatsWorkoutTypeSliceOut(BaseModel):
    id: str
    label: str
    count: int = Field(..., ge=0)
    percent: int = Field(..., ge=0, le=100)


class StatsWorkoutTypesOut(BaseModel):
    period: StatsPeriodId
    items: list[StatsWorkoutTypeSliceOut] = Field(default_factory=list)
