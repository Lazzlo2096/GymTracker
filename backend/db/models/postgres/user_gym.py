"""Модель фитнес-зала пользователя (PostgreSQL/SQLAlchemy)."""

from typing import TYPE_CHECKING, List, Optional
from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    text,
    UniqueConstraint,
    Index,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User
    from db.models.postgres.workout import Workout


class UserGym(Base):
    """
    Сохранённый пользователем зал для выбора при создании тренировки.
    Уникальность (user_id, name) в рамках одного пользователя.
    """

    __tablename__ = "user_gyms"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_gym_user_name"),
        Index("ix_user_gyms_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_favorite: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    review_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    review_updated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    last_visited_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    tags: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    gallery_urls: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    user: Mapped["User"] = relationship(
        back_populates="user_gyms",
        foreign_keys=[user_id],
    )
    workouts: Mapped[List["Workout"]] = relationship(back_populates="user_gym")
