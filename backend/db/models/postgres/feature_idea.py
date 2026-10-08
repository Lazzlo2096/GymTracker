"""Идеи пользователей (предложения улучшений)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base
from db.models.postgres.feature_idea_status import FeatureIdeaStatus

if TYPE_CHECKING:
    from db.models.postgres.user import User
    from db.models.postgres.feature_idea_like import FeatureIdeaLike


class FeatureIdea(Base):
    """
    Предложение функции от пользователя.

    Публикуется после is_approved=True (вручную в БД).
    author_user_id в API не отдаётся.
    """

    __tablename__ = "feature_ideas"
    __table_args__ = (
        Index("ix_feature_ideas_approved_created", "is_approved", "created_at"),
        Index("ix_feature_ideas_author", "author_user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    author_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    status: Mapped[Optional[FeatureIdeaStatus]] = mapped_column(
        SAEnum(
            FeatureIdeaStatus,
            native_enum=False,
            length=32,
            values_callable=lambda x: [e.value for e in FeatureIdeaStatus],
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    author: Mapped["User"] = relationship(
        foreign_keys=[author_user_id],
        lazy="raise",
    )
    likes: Mapped[List["FeatureIdeaLike"]] = relationship(
        back_populates="idea",
        cascade="all, delete-orphan",
    )
