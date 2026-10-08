"""Разбор IntegrityError: конфликт уникальности отдельно от прочих нарушений."""

from __future__ import annotations

import logging
from typing import NoReturn

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)

UNIQUE_VIOLATION = "23505"


def is_unique_violation(exc: IntegrityError) -> bool:
    """PostgreSQL 23505: строка нарушает уникальный индекс или ограничение."""
    orig = getattr(exc, "orig", None)
    sqlstate = getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)
    if sqlstate == UNIQUE_VIOLATION:
        return True
    return type(orig).__name__ == "UniqueViolationError"


async def rollback_and_raise_integrity(
    session: AsyncSession,
    exc: IntegrityError,
    *,
    conflict_detail: str,
    other_detail: str,
) -> NoReturn:
    """
    Откатывает сессию и поднимает HTTPException.

    Уникальный конфликт — 409. FK, CHECK, NOT NULL и остальные IntegrityError — 400.
    """
    await session.rollback()
    if is_unique_violation(exc):
        raise HTTPException(status_code=409, detail=conflict_detail) from exc
    orig = getattr(exc, "orig", None)
    sqlstate = getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)
    log.warning("integrity error sqlstate=%s", sqlstate)
    raise HTTPException(status_code=400, detail=other_detail) from exc
