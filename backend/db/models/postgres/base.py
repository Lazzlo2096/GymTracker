"""Базовый класс SQLAlchemy для PostgreSQL."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Базовый класс для всех моделей PostgreSQL."""

    pass
