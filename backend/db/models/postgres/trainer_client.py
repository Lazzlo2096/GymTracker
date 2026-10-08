"""Связь тренер → подопечный (для выдачи списка тренировок клиентов)."""

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.postgres.base import Base


class TrainerClient(Base):
    """Тренер видит тренировки пользователей из этой таблицы (и свои)."""

    __tablename__ = "trainer_clients"
    __table_args__ = (
        UniqueConstraint(
            "trainer_id", "client_id", name="uq_trainer_clients_trainer_client"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trainer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
