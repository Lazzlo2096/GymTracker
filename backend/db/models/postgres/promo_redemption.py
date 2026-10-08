"""Погашения промокодов."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP, Float

from db.models.postgres.base import Base

if TYPE_CHECKING:
    from db.models.postgres.user import User
    from db.models.postgres.promo_code import PromoCode


class PromoRedemption(Base):
    __tablename__ = "promo_redemptions"
    __table_args__ = (
        UniqueConstraint(
            "redeemer_user_id",
            "promo_code_id",
            name="uq_promo_redemptions_redeemer_code",
        ),
        Index(
            "uq_promo_redemptions_one_referral_per_user",
            "redeemer_user_id",
            unique=True,
            postgresql_where=text("is_referral_redemption = true"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    promo_code_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("promo_codes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    redeemer_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    is_referral_redemption: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    redeemer_tonnage_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    owner_rewarded_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    premium_days_granted: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    promo_code: Mapped["PromoCode"] = relationship(
        back_populates="redemptions", lazy="selectin"
    )
    redeemer: Mapped["User"] = relationship(
        foreign_keys=[redeemer_user_id],
        lazy="selectin",
    )
