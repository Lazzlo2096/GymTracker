"""
Конфигурация приложения через переменные окружения (pydantic-settings).

Плоские имена полей в .env совпадают с именами полей в группах (AUTH_SECRET, DATABASE_URL и т.д.).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic.functional_validators import BeforeValidator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_ROOT = Path(__file__).resolve().parent
_REPO_ROOT = _ROOT.parent

AUTH_SECRET_DEFAULT = "gymtracker-dev-auth-secret-min-32-chars-change-in-prod"
_DEFAULT_MEDIA_ROOT = _ROOT / "media"
CORS_DEFAULT_LOCAL_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"


def configure_logging(level: int = logging.INFO) -> None:
    """Настраивает корневой logging для консоли."""

    logging.basicConfig(
        level=level,
        datefmt="%Y-%m-%d %H:%M:%S",
        format=(
            "[%(asctime)s.%(msecs)03d] %(funcName)20s "
            "%(module)s:%(lineno)d %(levelname)-8s - %(message)s"
        ),
        handlers=[logging.StreamHandler()],
    )


def _env_files() -> tuple[str, ...]:
    """backend/.env, корень репозитория и prod-файлы при наличии."""

    paths = (
        _ROOT / ".env",
        _REPO_ROOT / ".env",
        _REPO_ROOT / ".env.prod",
        _REPO_ROOT / "deploy" / "prod" / ".env.prod",
    )
    return tuple(str(p) for p in paths if p.is_file())


_SETTINGS_CONFIG = SettingsConfigDict(
    env_file=_env_files() or None,
    env_file_encoding="utf-8",
    extra="ignore",
)


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "y", "on")


def _split_csv_list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    return [x.strip() for x in str(value).split(",") if x.strip()]


class DatabaseSettings(BaseModel):
    """PostgreSQL."""

    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/gymtracker"
    )


class EnvironmentSettings(BaseModel):
    """Режим запуска."""

    ENVIRONMENT: Literal["development", "production"] = "development"

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def _normalize_environment(cls, value: Any) -> str:
        return str(value or "development").strip().lower()


class AuthSettings(BaseModel):
    """JWT / AuthX."""

    AUTH_SECRET: str = AUTH_SECRET_DEFAULT
    ACCESS_TTL_MINUTES: int = Field(default=15, ge=1)
    REFRESH_TTL_DAYS: int = Field(default=30, ge=1)


class CookieSettings(BaseModel):
    """HTTP-only cookies."""

    COOKIE_SECURE: Annotated[bool, BeforeValidator(_parse_bool)] = False
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    COOKIE_DOMAIN: str = ""

    @field_validator("COOKIE_SAMESITE", mode="before")
    @classmethod
    def _normalize_samesite(cls, value: Any) -> str:
        return str(value or "lax").strip().lower()


class CorsSettings(BaseModel):
    """CORS для SPA и мобильного клиента."""

    CORS_ALLOWED_ORIGINS: Annotated[
        list[str], NoDecode, BeforeValidator(_split_csv_list)
    ] = Field(default_factory=list)
    CORS_ALLOW_ORIGIN_REGEX: str = ""


class GoogleOAuthSettings(BaseModel):
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_DEFAULT_REDIRECT_URI: str = ""


class VkOAuthSettings(BaseModel):
    VK_OAUTH_CLIENT_ID: str = ""
    VK_OAUTH_CLIENT_SECRET: str = ""
    VK_OAUTH_DEFAULT_REDIRECT_URI: str = ""


class YandexOAuthSettings(BaseModel):
    YANDEX_OAUTH_CLIENT_ID: str = ""
    YANDEX_OAUTH_CLIENT_SECRET: str = ""
    YANDEX_OAUTH_DEFAULT_REDIRECT_URI: str = ""


class YooKassaSettings(BaseModel):
    """Платежи YooKassa."""

    YOOKASSA_SHOP_ID: str = ""
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_RETURN_URL_DEFAULT: str = ""


class MediaSettings(BaseModel):
    """Локальное хранение медиа."""

    MEDIA_ROOT: str = str(_DEFAULT_MEDIA_ROOT)
    MEDIA_URL_PREFIX: str = "/media"

    @property
    def media_root_path(self) -> Path:
        return Path(self.MEDIA_ROOT)


class RedisSettings(BaseModel):
    """Redis (кэш GET через fastapi-cache2, rate limit)."""

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = Field(default=6379, ge=1, le=65535)
    REDIS_GUI_PORT: int = Field(default=5540, ge=1, le=65535)
    # 0/false — отключить Redis-кэш GET (rate limit Redis остаётся). Для отладки stale после DELETE.
    ENABLE_REDIS_CACHE: bool = True


class HealthSettings(BaseModel):
    """GET /api/v1/health: пороги диска и путь проверки."""

    HEALTH_DISK_WARN_PERCENT: float = Field(default=85.0, ge=0, le=100)
    HEALTH_DISK_CRITICAL_PERCENT: float = Field(default=95.0, ge=0, le=100)
    HEALTH_DISK_PATH: str = ""


class SmtpSettings(BaseModel):
    """Исходящая почта (aiosmtplib). По умолчанию — maildev в Docker."""

    SMTP_HOST: str = "maildev"
    SMTP_PORT: int = Field(default=1025, ge=1, le=65535)
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@habitpro.ru"
    SMTP_USE_TLS: Annotated[bool, BeforeValidator(_parse_bool)] = False
    SMTP_USE_SSL: Annotated[bool, BeforeValidator(_parse_bool)] = False
    PUBLIC_APP_URL: str = "http://localhost"
    EMAIL_VERIFY_TOKEN_TTL_HOURS: int = Field(default=24, ge=1, le=168)


class FastAPICacheNamespaces(BaseModel):
    """Namespace fastapi-cache2 для GET-ручек."""

    list_workouts: str = "list-workouts"
    get_workout: str = "get-workout"

    list_user_gyms: str = "list-user-gyms"

    list_exercises_in_workout: str = "list-exercises-in-workout"
    get_exercise_in_workout: str = "get-exercise-in-workout"

    list_exercises_catalog: str = "list-exercises-catalog"
    catalog_log_summary: str = "catalog-log-summary"
    get_exercise_catalog: str = "get-exercise-catalog"

    list_trainer_clients: str = "list-trainer-clients"
    get_trainer_client: str = "get-trainer-client"

    me: str = "me"
    oauth_start: str = "oauth-start"

    get_payment_status: str = "get-payment-status"

    list_user_weights_crud: str = "list-user-weights-crud"

    list_workout_templates: str = "list-workout-templates"
    get_workout_template: str = "get-workout-template"


CACHE_DEFAULT_EXPIRE_SECONDS = 60
CACHE_EXERCISE_EXPIRE_SECONDS = 30
# GET /workouts/ и GET /workouts/{id}: короткий TTL + сброс после мутаций.
CACHE_WORKOUT_EXPIRE_SECONDS = 5


class Settings(
    BaseSettings,
    DatabaseSettings,
    EnvironmentSettings,
    AuthSettings,
    CookieSettings,
    CorsSettings,
    GoogleOAuthSettings,
    VkOAuthSettings,
    YandexOAuthSettings,
    YooKassaSettings,
    MediaSettings,
    RedisSettings,
    HealthSettings,
    SmtpSettings,
):
    """Переменные окружения API (см. .env.example, deploy/prod/.env.prod.example)."""

    model_config = _SETTINGS_CONFIG

    cache_namespaces: FastAPICacheNamespaces = Field(
        default_factory=FastAPICacheNamespaces
    )

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> Self:
        if self.ENVIRONMENT != "production":
            return self
        if (
            not self.AUTH_SECRET
            or self.AUTH_SECRET == AUTH_SECRET_DEFAULT
            or len(self.AUTH_SECRET) < 32
        ):
            raise ValueError(
                "В production задайте AUTH_SECRET (мин. 32 символа) через .env.prod — "
                "см. deploy/prod/generate-env.sh"
            )
        return self


class ScriptSettings(BaseSettings):
    """Переменные для локальных скриптов (префикс GYMTRACKER_)."""

    model_config = SettingsConfigDict(
        env_file=_env_files() or None,
        env_file_encoding="utf-8",
        env_prefix="GYMTRACKER_",
        extra="ignore",
    )

    HTTP_BASE: str = "http://127.0.0.1:8000"
    LOGIN: str = ""
    PASSWORD: str = ""
    USER_GYM_NAME: str = ""


class HttpTestSettings(ScriptSettings):
    """Те же GYMTRACKER_* переменные, дефолтный URL — uvicorn :8000."""

    HTTP_BASE: str = "http://127.0.0.1:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_script_settings() -> ScriptSettings:
    return ScriptSettings()


@lru_cache
def get_http_test_settings() -> HttpTestSettings:
    return HttpTestSettings()


settings = get_settings()
script_settings = get_script_settings()
http_test_settings = get_http_test_settings()
