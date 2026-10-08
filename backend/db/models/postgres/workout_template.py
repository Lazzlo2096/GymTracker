"""Шаблон тренировки (библиотека планов, без даты)."""

from typing import TYPE_CHECKING, List, Optional
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, Float, text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User
    from db.models.postgres.user_gym import UserGym
    from db.models.postgres.workout_template_exercise import WorkoutTemplateExercise


class WorkoutTemplate(Base):
    """Переиспользуемый шаблон тренировки пользователя."""

    __tablename__ = "workout_templates"
    __table_args__ = (Index("ix_workout_templates_user_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_gym_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("user_gyms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    estimated_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )

    user: Mapped["User"] = relationship(back_populates="workout_templates")
    user_gym: Mapped[Optional["UserGym"]] = relationship(lazy="selectin")
    exercises: Mapped[List["WorkoutTemplateExercise"]] = relationship(
        back_populates="workout_template",
        cascade="all, delete-orphan",
        order_by="WorkoutTemplateExercise.order_index",
        lazy="selectin",
    )
