"""Упражнение внутри шаблона тренировки."""

from typing import TYPE_CHECKING, Optional
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
    text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.exercise_in_catalog import ExerciseInCatalog
    from db.models.postgres.workout_template import WorkoutTemplate


class WorkoutTemplateExercise(Base):
    """Строка плана в шаблоне: каталог и/или текст, опциональный planned_sets_json."""

    __tablename__ = "workout_template_exercises"
    __table_args__ = (
        Index("ix_wte_template_order", "workout_template_id", "order_index"),
        CheckConstraint(
            "jsonb_typeof(planned_sets_json) = 'array'",
            name="ck_wte_planned_sets_is_array",
        ),
        CheckConstraint(
            "exercise_in_catalog_id IS NOT NULL OR title_override IS NOT NULL",
            name="ck_wte_catalog_or_title",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workout_template_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("workout_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    exercise_in_catalog_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("exercises_in_catalog.id", ondelete="SET NULL"),
        nullable=True,
    )
    title_override: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    muscle_group: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    planned_sets_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    planned_tonnage_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    planned_all_reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    planned_all_weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    planned_all_rest_seconds: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    planned_sets_json: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    workout_template: Mapped["WorkoutTemplate"] = relationship(
        back_populates="exercises"
    )
    exercise: Mapped[Optional["ExerciseInCatalog"]] = relationship(lazy="selectin")
