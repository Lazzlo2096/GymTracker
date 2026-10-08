"""Строки профиля 1:1 (user_fitness_data, user_client_settings, user_reminds)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import User as PgUser
from db.models.postgres.user_client_settings import UserClientSettings
from db.models.postgres.user_fitness_data import UserFitnessData
from db.models.postgres.user_reminds import UserReminds

FITNESS_DATA_FIELDS = frozenset(
    {"height_cm", "training_goal", "target_weight_kg", "preferred_user_gym_id"}
)
CLIENT_SETTINGS_FIELDS = frozenset(
    {"measurement_units", "settings_dark_theme", "settings_notifications"}
)
REMINDS_FIELDS = frozenset(
    {
        "settings_workout_reminders",
        "workout_reminder_time",
        "workout_reminder_weekdays",
        "workout_reminder_timezone",
    }
)


async def ensure_user_profile_satellites(session: AsyncSession, user: PgUser) -> None:
    """Создать строки 1:1 с дефолтами, если их ещё нет."""
    if user.fitness_data is None:
        user.fitness_data = UserFitnessData(user_id=user.id)
        session.add(user.fitness_data)
    if user.client_settings is None:
        user.client_settings = UserClientSettings(user_id=user.id)
        session.add(user.client_settings)
    if user.reminds is None:
        user.reminds = UserReminds(user_id=user.id)
        session.add(user.reminds)
    await session.flush()


async def create_user_profile_satellites(session: AsyncSession, user_id: int) -> None:
    session.add_all(
        [
            UserFitnessData(user_id=user_id),
            UserClientSettings(user_id=user_id),
            UserReminds(user_id=user_id),
        ]
    )
    await session.flush()
