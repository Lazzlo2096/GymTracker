"""Системные (предустановленные) упражнения — шаблоны для копирования в каталог пользователя."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB

from db.models.postgres.base import Base


class SystemExercise(Base):
    __tablename__ = "system_exercises"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    muscle_group: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    machine_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    machine_settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
