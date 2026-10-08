"""Клиентские настройки пользователя (1:1 с users)."""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User


class UserClientSettings(Base):
    __tablename__ = "user_client_settings"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    measurement_units: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'metric'")
    )
    settings_dark_theme: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    settings_notifications: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    user: Mapped["User"] = relationship(back_populates="client_settings")
