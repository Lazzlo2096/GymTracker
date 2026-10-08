"""Программа тренировок пользователя (тело — JSON, схема plans.ProgramOut)."""

from typing import TYPE_CHECKING
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User


class TrainingProgram(Base):
    """
    Программа тренировок пользователя.

    Сплит и метаданные хранятся в `program_json` (JSONB) в формате API
    `schemas.plans.ProgramOut` (discriminated union по `schedule_type`).
    """

    __tablename__ = "training_programs"
    __table_args__ = (
        CheckConstraint(
            "jsonb_typeof(program_json) = 'object'",
            name="ck_training_programs_json_object",
        ),
        Index("ix_training_programs_user_id", "user_id"),
        Index(
            "uq_training_programs_user_current",
            "user_id",
            unique=True,
            postgresql_where=text("is_current IS TRUE"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    program_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
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

    user: Mapped["User"] = relationship(back_populates="training_programs")
