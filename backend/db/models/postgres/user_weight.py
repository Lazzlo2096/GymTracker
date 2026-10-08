"""Модель измерения веса (PostgreSQL/SQLAlchemy)."""

from typing import Optional
from datetime import datetime

from sqlalchemy import (
    text,
    Text,
    Numeric,
    ForeignKey,
    Integer,
    UniqueConstraint,
    CheckConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base


class UserWeight(Base):
    """Запись измерения веса пользователя."""

    __tablename__ = "user_weights"
    __table_args__ = (
        UniqueConstraint("user_id", "measured_at", name="uq_user_weight_user_time"),
        CheckConstraint("weight_kg > 0", name="ck_user_weight_positive"),
        CheckConstraint(
            "body_fat_percent IS NULL OR (body_fat_percent > 0 AND body_fat_percent <= 100)",
            name="ck_user_weight_body_fat_percent_range",
        ),
        Index("ix_user_weight_user_time", "user_id", "measured_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    measured_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    weight_kg: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    body_fat_percent: Mapped[Optional[float]] = mapped_column(
        Numeric(4, 1), nullable=True
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    user: Mapped["User"] = relationship(back_populates="weights")
