"""Expo push-токен устройства пользователя."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base


class UserPushToken(Base):
    __tablename__ = "user_push_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expo_push_token: Mapped[str] = mapped_column(
        String(256), unique=True, nullable=False
    )
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
