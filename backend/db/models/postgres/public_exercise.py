"""Публичные упражнения — опубликованные пользователями копии для общего каталога."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User


class PublicExercise(Base):
    __tablename__ = "public_exercises"
    __table_args__ = (
        Index("ix_public_exercises_author_user_id", "author_user_id"),
        Index("ix_public_exercises_published_at", "published_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    author_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_catalog_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("exercises_in_catalog.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    muscle_group: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    machine_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    machine_settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    published_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    author: Mapped["User"] = relationship(
        foreign_keys=[author_user_id],
        lazy="selectin",
    )
