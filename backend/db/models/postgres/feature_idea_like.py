"""Лайки идей (отдельная таблица user ↔ idea)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP
from sqlalchemy import text

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.feature_idea import FeatureIdea
    from db.models.postgres.user import User


class FeatureIdeaLike(Base):
    """Кто лайкнул идею — не показывается другим пользователям, только liked_by_me у зрителя."""

    __tablename__ = "feature_ideas_likes"
    __table_args__ = (
        UniqueConstraint("idea_id", "user_id", name="uq_feature_idea_like_idea_user"),
        Index("ix_feature_ideas_likes_idea_id", "idea_id"),
        Index("ix_feature_ideas_likes_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    idea_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("feature_ideas.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    idea: Mapped["FeatureIdea"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship(lazy="raise")
