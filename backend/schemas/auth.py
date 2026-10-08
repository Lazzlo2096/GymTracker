"""Схемы для auth (AuthX)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Literal, Optional


class LoginRequest(BaseModel):
    """Логин: email или username + пароль."""

    login: str  # email или имя пользователя
    password: str


def _validate_password_complexity(v: str) -> str:
    """Регистрация: минимум 8 символов (без пробелов по краям)."""
    s = v.strip()
    if len(s) < 8:
        raise ValueError("Пароль должен быть не менее 8 символов")
    if len(s) > 128:
        raise ValueError("Пароль слишком длинный (максимум 128 символов)")
    return s


class RegisterRequest(BaseModel):
    """Регистрация: почта, имя пользователя и пароль."""

    email: EmailStr
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)
    promo_code: Optional[str] = Field(default=None, max_length=32)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_complexity(v)


class TokenResponse(BaseModel):
    """JWT токены (дублируются в cookies)."""

    access_token: str
    refresh_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int | None = None


class UserGymBriefOut(BaseModel):
    """Выбранный зал для профиля (кратко)."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(...)
    name: str = Field(..., max_length=256)
    address: Optional[str] = Field(default=None)


class UserMe(BaseModel):
    """Данные текущего пользователя (auth/me)."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(...)
    email: str = Field(...)
    display_name: str = Field(...)
    role: str = Field(..., description="user | trainer | admin")
    created_at: datetime = Field(...)
    experience_label: str = Field(..., description="Стаж с даты регистрации, по-русски")
    avatar_url: Optional[str] = Field(default=None)
    height_cm: Optional[int] = Field(default=None, description="Рост, см")
    birth_date: Optional[date] = Field(
        default=None, description="Дата рождения (локальный календарный день)"
    )
    training_goal: Optional[str] = Field(default=None, description="Цель тренировок")
    measurement_units: str = Field(default="metric", description="metric | imperial")
    settings_notifications: bool = Field(default=True)
    settings_dark_theme: bool = Field(default=False)
    settings_workout_reminders: bool = Field(default=True)
    workout_reminder_time: Optional[str] = Field(
        default=None,
        description="Устарело: напоминание будет за 3 ч до запланированной тренировки",
    )
    workout_reminder_weekdays: str = Field(
        default="1,2,3,4,5,6,7",
        description="Устарело: для будущего планирования",
    )
    workout_reminder_timezone: str = Field(default="UTC")
    preferred_user_gym_id: Optional[int] = Field(default=None)
    preferred_gym: Optional[UserGymBriefOut] = Field(
        default=None, description="Карточка выбранного зала"
    )
    target_weight_kg: Optional[int] = Field(
        default=None, description="Целевой вес (кг)"
    )
    is_premium: bool = Field(default=False)
    premium_until: Optional[datetime] = None
    premium_lifetime: bool = Field(default=False)
    email_verified_at: Optional[datetime] = Field(
        default=None, description="Когда email подтверждён"
    )
    is_email_verified: bool = Field(
        default=False, description="True, если email_verified_at задан"
    )


def _age_completed_years(birth: date, today: date) -> int:
    y = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        y -= 1
    return y


class UserMeUpdate(BaseModel):
    """Частичное обновление профиля (PATCH /auth/me)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    height_cm: Optional[int] = Field(
        default=None, ge=50, le=280, description="Рост, см; null — сброс"
    )
    birth_date: Optional[date] = Field(
        default=None, description="Дата рождения; null — сброс"
    )
    training_goal: Optional[str] = Field(default=None, max_length=256)
    target_weight_kg: Optional[int] = Field(default=None, ge=20, le=500)
    measurement_units: Optional[Literal["metric", "imperial"]] = None
    settings_notifications: Optional[bool] = None
    settings_dark_theme: Optional[bool] = None
    settings_workout_reminders: Optional[bool] = None
    workout_reminder_time: Optional[str] = Field(
        default=None, description="HH:MM или null — сброс"
    )
    workout_reminder_weekdays: Optional[str] = Field(
        default=None, max_length=32, description="1,2,3…7 через запятую"
    )
    workout_reminder_timezone: Optional[str] = Field(default=None, max_length=64)
    preferred_user_gym_id: Optional[int] = None

    @field_validator("workout_reminder_time")
    @classmethod
    def validate_reminder_time(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        parts = v.strip().split(":")
        if len(parts) != 2:
            raise ValueError("Формат времени: HH:MM")
        h, m = int(parts[0]), int(parts[1])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("Некорректное время")
        return f"{h:02d}:{m:02d}"

    @field_validator("workout_reminder_weekdays")
    @classmethod
    def validate_weekdays(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        for part in v.split(","):
            part = part.strip()
            if not part:
                continue
            d = int(part)
            if d < 1 or d > 7:
                raise ValueError("Дни недели: 1–7 (ISO)")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: Optional[date]) -> Optional[date]:
        if v is None:
            return v
        today = date.today()
        if v > today:
            raise ValueError("Дата рождения не может быть в будущем")
        age = _age_completed_years(v, today)
        if age < 5:
            raise ValueError("Возраст должен быть не менее 5 лет")
        if age > 120:
            raise ValueError("Возраст должен быть не более 120 лет")
        return v


OAuthProvider = Literal["google", "vk", "yandex"]


class OAuthStartResponse(BaseModel):
    """Ссылка для старта OAuth во внешнем провайдере."""

    auth_url: str
    provider: OAuthProvider


class OAuthExchangeRequest(BaseModel):
    """Код авторизации от провайдера и redirect_uri из шага authorize."""

    code: str = Field(..., min_length=1)
    redirect_uri: str | None = None
    promo_code: Optional[str] = Field(default=None, max_length=32)
