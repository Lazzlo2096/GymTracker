"""Промокоды: referral (у пользователя), blogger/simple (кампании)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User
    from db.models.postgres.promo_redemption import PromoRedemption


class PromoCode(Base):
    __tablename__ = "promo_codes"
    __table_args__ = (
        Index(
            "uq_promo_codes_referral_owner",
            "owner_user_id",
            unique=True,
            postgresql_where=text("type = 'referral'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    owner: Mapped[Optional["User"]] = relationship(
        foreign_keys=[owner_user_id],
        lazy="selectin",
    )
    redemptions: Mapped[List["PromoRedemption"]] = relationship(
        back_populates="promo_code",
        cascade="all, delete-orphan",
        lazy="noload",
    )
