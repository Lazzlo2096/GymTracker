"""Схемы экрана «Планы»."""

from datetime import date as calendar_date
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

ProgramScheduleType = Literal["week_fixed", "sequence", "cycle_pattern", "weekly_quota"]
ProgramDayKind = Literal["workout", "rest"]
ProgramSlotState = Literal["done", "skip", "next"]


class ProgramCyclePatternSpec(BaseModel):
    """Компактный ритм: X тренировок подряд, затем Y дней отдыха."""

    work: int = Field(..., ge=1, description="Подряд идущих тренировочных дней в цикле")
    rest: int = Field(..., ge=1, description="Дней отдыха после блока тренировок")


class _ProgramDayBase(BaseModel):
    slot: int = Field(
        ...,
        ge=1,
        description="Порядковый номер слота в программе (1-based); для week_fixed совпадает с iso_weekday",
    )
    kind: ProgramDayKind = Field(
        ...,
        description="Тип слота: тренировка или отдых",
    )
    iso_weekday: int | None = Field(
        default=None,
        ge=1,
        le=7,
        description=(
            "День недели ISO 8601 (1 — пн, 7 — вс); null — слот без привязки к дню недели"
        ),
    )
    template_id: int | None = Field(
        default=None,
        ge=1,
        description="ID шаблона тренировки; null — день без шаблона (отдых)",
    )
    enabled: bool = Field(..., description="Активен ли тренировочный день в программе")


class ProgramDayWeekFixed(_ProgramDayBase):
    """Слот week_fixed — без поля state."""


class ProgramDaySequence(_ProgramDayBase):
    """Слот sequence: прогресс выполнения (state)."""

    state: ProgramSlotState | None = Field(
        default=None,
        description=(
            "done | skip | next. Legacy без поля при чтении трактуется как next. "
            "Станет обязательным для всех слотов."
        ),
    )


class ProgramDaySequenceCreate(_ProgramDayBase):
    """Слот sequence при POST/PATCH: ключ state обязателен."""

    state: ProgramSlotState | None = Field(
        ...,
        description=(
            "Обязательное поле при создании/обновлении sequence. "
            "done | skip | next; null — слот ещё не пройден."
        ),
    )


# Обратная совместимость импортов
ProgramDayOut = ProgramDayWeekFixed | ProgramDaySequence


class _ProgramBase(BaseModel):
    id: int = Field(..., ge=1, description="ID программы")
    name: str = Field(..., min_length=1, description="Название программы")


class ProgramWeekFixedOut(_ProgramBase):
    """Программа с привязкой слотов к дням недели."""

    schedule_type: Literal["week_fixed"] = "week_fixed"
    days: list[ProgramDayWeekFixed] = Field(..., min_length=1)


class ProgramSequenceOut(_ProgramBase):
    """Программа как упорядоченная последовательность слотов."""

    schedule_type: Literal["sequence"] = "sequence"
    days: list[ProgramDaySequence] = Field(..., min_length=1)


class ProgramCyclePatternOut(_ProgramBase):
    """Программа с ритмом X тренировок / Y отдыха и ротацией шаблонов."""

    schedule_type: Literal["cycle_pattern"] = "cycle_pattern"
    pattern: ProgramCyclePatternSpec
    templates: list[int] = Field(
        ..., min_length=1, description="Ротация шаблонов в цикле"
    )


class ProgramWeeklyQuotaOut(_ProgramBase):
    """N тренировок в неделю без привязки к конкретным дням."""

    schedule_type: Literal["weekly_quota"] = "weekly_quota"
    sessions_per_week: int = Field(..., ge=1, le=7)
    rotation: list[int] = Field(
        ..., min_length=1, description="Ротация шаблонов по сессиям"
    )
    min_rest_between_sessions_hours: int | None = Field(
        default=None,
        ge=0,
        description="Минимальный отдых между тренировками в часах",
    )


ProgramOut = Annotated[
    ProgramWeekFixedOut
    | ProgramSequenceOut
    | ProgramCyclePatternOut
    | ProgramWeeklyQuotaOut,
    Field(discriminator="schedule_type"),
]

program_out_adapter = TypeAdapter(ProgramOut)


def normalize_legacy_program_json(payload: dict[str, Any]) -> dict[str, Any]:
    """Нормализация program_json из БД перед валидацией ProgramOut."""
    data = dict(payload)
    schedule_type = data.get("schedule_type")
    days = data.get("days")
    if not isinstance(days, list):
        return data

    if schedule_type == "week_fixed":
        normalized_days: list[dict[str, Any]] = []
        for raw_day in days:
            if not isinstance(raw_day, dict):
                normalized_days.append(raw_day)
                continue
            day = dict(raw_day)
            day.pop("state", None)
            normalized_days.append(day)
        data["days"] = normalized_days
        return data

    if schedule_type == "sequence":
        normalized_days = []
        for raw_day in days:
            if not isinstance(raw_day, dict):
                normalized_days.append(raw_day)
                continue
            day = dict(raw_day)
            if "state" not in day:
                day["state"] = "next"
            normalized_days.append(day)
        data["days"] = normalized_days

    return data


class _ProgramCreateBase(BaseModel):
    name: str = Field(..., min_length=1, description="Название программы")


class ProgramWeekFixedCreate(_ProgramCreateBase):
    """Создание программы с привязкой слотов к дням недели."""

    model_config = ConfigDict(extra="forbid")

    schedule_type: Literal["week_fixed"] = "week_fixed"
    days: list[ProgramDayWeekFixed] = Field(..., min_length=1)

    @model_validator(mode="before")
    @classmethod
    def reject_state_on_days(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        days = data.get("days")
        if not isinstance(days, list):
            return data
        for day in days:
            if isinstance(day, dict) and "state" in day:
                raise ValueError("week_fixed: поле state в слотах не поддерживается")
        return data


class ProgramSequenceCreate(_ProgramCreateBase):
    """Создание программы как упорядоченной последовательности слотов."""

    schedule_type: Literal["sequence"] = "sequence"
    days: list[ProgramDaySequenceCreate] = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_sequence_states(self) -> Self:
        next_count = sum(1 for day in self.days if day.state == "next")
        if next_count != 1:
            raise ValueError("sequence: ровно один слот должен иметь state=next")
        return self


class ProgramCyclePatternCreate(_ProgramCreateBase):
    """Создание программы с ритмом X тренировок / Y отдыха."""

    schedule_type: Literal["cycle_pattern"] = "cycle_pattern"
    pattern: ProgramCyclePatternSpec
    templates: list[int] = Field(
        ..., min_length=1, description="Ротация шаблонов в цикле"
    )


class ProgramWeeklyQuotaCreate(_ProgramCreateBase):
    """Создание программы: N тренировок в неделю без привязки к дням."""

    schedule_type: Literal["weekly_quota"] = "weekly_quota"
    sessions_per_week: int = Field(..., ge=1, le=7)
    rotation: list[int] = Field(
        ..., min_length=1, description="Ротация шаблонов по сессиям"
    )
    min_rest_between_sessions_hours: int | None = Field(
        default=None,
        ge=0,
        description="Минимальный отдых между тренировками в часах",
    )


ProgramCreate = Annotated[
    ProgramWeekFixedCreate
    | ProgramSequenceCreate
    | ProgramCyclePatternCreate
    | ProgramWeeklyQuotaCreate,
    Field(discriminator="schedule_type"),
]

program_create_adapter = TypeAdapter(ProgramCreate)

# Полная замена program_json (PATCH /plans/program/{id})
ProgramUpdate = ProgramCreate


# --- Вкладка «Расписание» (/plans) ---

PlannedSessionStatus = Literal["plan_ready", "draft", "in_progress"]
PlannedSessionSource = Literal["repeat_previous", "from_template"]


class PlannedSessionOut(BaseModel):
    """Запланированная тренировка на дату (карточка вкладки «Расписание»)."""

    date: calendar_date = Field(..., description="Календарная дата (YYYY-MM-DD)")
    title: str = Field(..., min_length=1, description="Название тренировки")
    gym_name: str | None = Field(default=None, description="Зал; null — без привязки")
    exercises_count: int = Field(..., ge=0, description="Число упражнений в плане")
    estimated_minutes: int = Field(..., ge=0, description="Оценка длительности, мин")
    status: PlannedSessionStatus = Field(
        ...,
        description="plan_ready | draft | in_progress",
    )
    source: PlannedSessionSource | None = Field(
        default=None,
        description="Источник плана: repeat_previous | from_template",
    )
