"""Alembic environment: подключение к PostgreSQL и метаданные моделей."""

from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Импорт только PostgreSQL-моделей
from db.models.postgres.base import Base
from db.models.postgres import (
    User,
    UserWeight,
    UserGym,
    ExerciseInCatalog,
    Workout,
    ExerciseInWorkout,
    TrainerClient,
    Payment,
    PromoCode,
    PromoRedemption,
    SystemExercise,
    PublicExercise,
    UserPushToken,
    NotificationLog,
    EmailVerificationToken,
    WorkoutTemplate,
    TrainingProgram,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

from project_config import configure_logging, settings

configure_logging()

# DATABASE_URL из pydantic-settings; для Alembic — sync psycopg2.
_DATABASE_URL = settings.DATABASE_URL
# Alembic работает только с синхронными драйверами
if "+asyncpg" in _DATABASE_URL:
    _DATABASE_URL = _DATABASE_URL.replace("+asyncpg", "+psycopg2", 1)
config.set_main_option("sqlalchemy.url", _DATABASE_URL)


def run_migrations_offline() -> None:
    """Offline mode: генерируем SQL без подключения к БД."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Online mode: выполняем миграции с подключением к БД."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
