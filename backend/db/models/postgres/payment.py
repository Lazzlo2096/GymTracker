"""Модель платежа YooKassa (PostgreSQL/SQLAlchemy)."""

from typing import Optional
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from db.models.postgres.base import Base


class Payment(Base):
    """Платёж пользователя через YooKassa."""

    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_user_created", "user_id", "created_at"),
        Index("ix_payments_provider_status", "provider", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=text("'yookassa'")
    )
    provider_payment_id: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False, index=True
    )
    idempotence_key: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )

    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default=text("'RUB'")
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=text("'pending'")
    )
    confirmation_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    provider_payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
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

    user: Mapped["User"] = relationship(back_populates="payments")
