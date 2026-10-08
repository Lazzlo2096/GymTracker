"""Журнал отправленных уведомлений (дедупликация)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base


class NotificationLog(Base):
    __tablename__ = "notification_log"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "kind", "dedup_key", name="uq_notification_log_dedup"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    dedup_key: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
