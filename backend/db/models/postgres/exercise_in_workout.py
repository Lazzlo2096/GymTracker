"""Модель упражнения в тренировке (PostgreSQL/SQLAlchemy)."""

from typing import TYPE_CHECKING, Optional
from datetime import datetime

from sqlalchemy import text, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import CheckConstraint, UniqueConstraint

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.workout import Workout
    from db.models.postgres.exercise_in_catalog import ExerciseInCatalog


class ExerciseInWorkout(Base):
    """
    Экземпляр упражнения в тренировке с подходами (log).

    Таблица `exercise_in_workout`; подходы — `sets_json` (JSONB).
    """

    __tablename__ = "exercise_in_workout"
    __table_args__ = (
        # DEFERRABLE: два order_index можно обменять в одной транзакции.
        UniqueConstraint(
            "workout_id",
            "order_index",
            name="uq_we_workout_order",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "jsonb_typeof(sets_json) = 'array'", name="ck_we_sets_is_array"
        ),
        CheckConstraint(
            "jsonb_typeof(planned_sets_json) = 'array'",
            name="ck_we_planned_sets_is_array",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workout_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    exercise_in_catalog_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("exercises_in_catalog.id", ondelete="SET NULL")
    )
    sets_json: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    planned_sets_json: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    planned_sets: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    workout: Mapped["Workout"] = relationship(back_populates="exercises")
    exercise: Mapped[Optional["ExerciseInCatalog"]] = relationship(lazy="selectin")
