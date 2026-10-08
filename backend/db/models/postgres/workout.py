"""Модель тренировки (PostgreSQL/SQLAlchemy)."""

from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date

from sqlalchemy import String, Text, Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP
from sqlalchemy import text, Index

from db.models.postgres.base import Base
from db.models.postgres.exercise_in_workout import ExerciseInWorkout

if TYPE_CHECKING:
    from db.models.postgres.user_gym import UserGym


class Workout(Base):
    """Тренировка пользователя."""

    __tablename__ = "workouts"
    __table_args__ = (Index("ix_workout_user_date", "user_id", "workout_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    workout_date: Mapped[date] = mapped_column(Date, nullable=False)
    day_title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_gym_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("user_gyms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    user: Mapped["User"] = relationship(back_populates="workouts")
    user_gym: Mapped[Optional["UserGym"]] = relationship(
        back_populates="workouts", lazy="selectin"
    )
    exercises: Mapped[List[ExerciseInWorkout]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by=ExerciseInWorkout.order_index,
    )
