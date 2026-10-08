"""Модель пользователя (PostgreSQL/SQLAlchemy)."""

from typing import Optional, List, TYPE_CHECKING
from datetime import date, datetime

from sqlalchemy import Date, Enum as SAEnum, text, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP, Text, Boolean

from db.models.postgres.base import Base
from db.models.postgres.user_role import UserRole

if TYPE_CHECKING:
    from db.models.postgres.email_verification_token import EmailVerificationToken
    from db.models.postgres.user_refresh_session import UserRefreshSession
    from db.models.postgres.workout_template import WorkoutTemplate
    from db.models.postgres.training_program import TrainingProgram
    from db.models.postgres.user_fitness_data import UserFitnessData
    from db.models.postgres.user_client_settings import UserClientSettings
    from db.models.postgres.user_reminds import UserReminds


class User(Base):
    """Пользователь приложения."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(
        String,
        nullable=True,
        comment="Хеш пароля (argon2). Для старых записей может быть NULL",
    )
    display_name: Mapped[str] = mapped_column(
        String, nullable=False, unique=True, index=True
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            native_enum=False,
            length=20,
            values_callable=lambda x: [e.value for e in UserRole],
        ),
        nullable=False,
        default=UserRole.user,
        server_default=text("'user'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="Когда email подтверждён; NULL — ожидает верификации",
    )

    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    premium_until: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    premium_lifetime: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )

    fitness_data: Mapped[Optional["UserFitnessData"]] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    client_settings: Mapped[Optional["UserClientSettings"]] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    reminds: Mapped[Optional["UserReminds"]] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    weights: Mapped[List["UserWeight"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    workouts: Mapped[List["Workout"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    catalog_exercises: Mapped[List["ExerciseInCatalog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    user_gyms: Mapped[List["UserGym"]] = relationship(
        back_populates="user",
        foreign_keys="UserGym.user_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    payments: Mapped[List["Payment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    refresh_sessions: Mapped[List["UserRefreshSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    email_verification_tokens: Mapped[List["EmailVerificationToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    workout_templates: Mapped[List["WorkoutTemplate"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    training_programs: Mapped[List["TrainingProgram"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
