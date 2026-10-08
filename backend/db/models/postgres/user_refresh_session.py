"""Refresh-сессии JWT: отдельная запись на устройство/вход."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User


class UserRefreshSession(Base):
    __tablename__ = "user_refresh_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    jti: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    last_used_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    user: Mapped["User"] = relationship(back_populates="refresh_sessions")
