"""Модель каталога упражнений (PostgreSQL/SQLAlchemy)."""

from typing import TYPE_CHECKING, Optional
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import UniqueConstraint, Index

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User
    from db.models.postgres.user_gym import UserGym


class ExerciseInCatalog(Base):
    """Упражнение из справочника (набор упражнений у каждого пользователя свой)."""

    __tablename__ = "exercises_in_catalog"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_exercise_catalog_user_name"),
        Index("ix_exercise_catalog_name_trgm", "name"),
        Index("ix_exercises_in_catalog_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    muscle_group: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    exercise_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    machine_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    machine_settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_gym_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("user_gyms.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_system_exercise_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("system_exercises.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_public_exercise_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("public_exercises.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    user: Mapped["User"] = relationship(back_populates="catalog_exercises")
    user_gym: Mapped[Optional["UserGym"]] = relationship(
        foreign_keys=[user_gym_id],
    )
