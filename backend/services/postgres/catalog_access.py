"""Правила доступа к каталогу упражнений (per-user)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres.user import User as PgUser
from db.models.postgres.user_role import UserRole
from db.repositories.postgres.workout_repository import list_client_ids_for_trainer
from fastapi import HTTPException


def _normalize_role(role: UserRole | str) -> UserRole:
    if isinstance(role, UserRole):
        return role

    try:
        return UserRole(role)
    except ValueError:
        return UserRole.user


def _parse_owner_query(owner: str | None) -> int | None:
    if owner is None:
        return None

    s = str(owner).strip()
    if not s:
        return None

    if not s.isdigit():
        raise HTTPException(
            status_code=422,
            detail="Параметр owner должен быть целым id пользователя",
        )

    return int(s, 10)


async def resolve_catalog_scope_user_ids(
    session: AsyncSession,
    auth_user: PgUser,
    owner_query: str | None,
) -> list[int] | None:
    """
    Какие user_id каталога разрешено видеть в списке.
    None — без фильтра (все пользователи), только для admin.
    """
    role = _normalize_role(auth_user.role)
    parsed = _parse_owner_query(owner_query) if owner_query is not None else None

    if role == UserRole.admin:
        if parsed is not None:
            return [parsed]
        return None

    if role == UserRole.user:
        if parsed is not None and parsed != auth_user.id:
            raise HTTPException(
                status_code=403,
                detail="Нет доступа к каталогу другого пользователя",
            )
        return [auth_user.id]

    trainees = await list_client_ids_for_trainer(session, auth_user.id)
    allowed = {auth_user.id, *trainees}
    if parsed is not None:
        if parsed not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Нет доступа к каталогу этого пользователя",
            )
        return [parsed]
    return sorted(allowed)


async def can_access_catalog_owner(
    session: AsyncSession,
    auth_user: PgUser,
    catalog_owner_id: int,
) -> bool:
    """Можно ли читать/менять запись каталога, принадлежащую catalog_owner_id."""
    role = _normalize_role(auth_user.role)

    if role == UserRole.admin:
        return True

    if role == UserRole.user:
        return catalog_owner_id == auth_user.id

    trainees = await list_client_ids_for_trainer(session, auth_user.id)
    return catalog_owner_id in {auth_user.id, *trainees}
