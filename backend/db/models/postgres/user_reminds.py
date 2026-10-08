"""Напоминания и расписание push (1:1 с users)."""

from __future__ import annotations

from datetime import time
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Time, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User


class UserReminds(Base):
    __tablename__ = "user_reminds"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    settings_workout_reminders: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    workout_reminder_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    workout_reminder_weekdays: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=text("'1,2,3,4,5,6,7'")
    )
    workout_reminder_timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default=text("'UTC'")
    )

    user: Mapped["User"] = relationship(back_populates="reminds")
