"""Фитнес-профиль пользователя: рост, цели, предпочитаемый зал (1:1 с users)."""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User
    from db.models.postgres.user_gym import UserGym


class UserFitnessData(Base):
    __tablename__ = "user_fitness_data"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    height_cm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    training_goal: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    target_weight_kg: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    preferred_user_gym_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("user_gyms.id", ondelete="SET NULL"),
        nullable=True,
    )

    user: Mapped["User"] = relationship(back_populates="fitness_data")
    preferred_user_gym: Mapped[Optional["UserGym"]] = relationship(
        foreign_keys=[preferred_user_gym_id],
        lazy="selectin",
    )
