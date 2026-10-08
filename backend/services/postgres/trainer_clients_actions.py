"""Связи trainer_clients: список, создание, удаление."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import asc, desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import TrainerClient, User as PgUser
from db.models.postgres.user_role import UserRole
from schemas.trainer_clients import TrainerClientCreate
from utils.cache import invalidate_trainer_clients_cache
from utils.db_errors import rollback_and_raise_integrity


def _normalize_role(role: UserRole | str) -> UserRole:
    """Приводит значение роли к enum `UserRole` (неизвестное — `user`)."""
    if isinstance(role, UserRole):
        return role

    try:
        return UserRole(role)
    except ValueError:
        return UserRole.user


def _row_to_dict(row: TrainerClient) -> dict[str, int]:
    """Преобразует ORM-строку в JSON-сериализуемый dict для ответа API."""
    return {
        "id": row.id,
        "trainer_id": row.trainer_id,
        "client_id": row.client_id,
    }


async def postgres_list_trainer_clients(
    session: AsyncSession,
    auth_user: PgUser,
    *,
    trainer_id_filter: int | None,
    client_id_filter: int | None,
    sort_by: str | None,
    sort_desc: bool,
    limit: int | None,
    offset: int | None,
) -> list[dict[str, int]]:
    """Список строк `trainer_clients` с учётом роли вызывающего и query-фильтров."""
    role = _normalize_role(auth_user.role)
    stmt = select(TrainerClient)

    if role == UserRole.admin:
        if trainer_id_filter is not None:
            stmt = stmt.where(TrainerClient.trainer_id == trainer_id_filter)
        if client_id_filter is not None:
            stmt = stmt.where(TrainerClient.client_id == client_id_filter)

    elif role == UserRole.trainer:
        stmt = stmt.where(TrainerClient.trainer_id == auth_user.id)
        if client_id_filter is not None:
            stmt = stmt.where(TrainerClient.client_id == client_id_filter)

    else:
        stmt = stmt.where(TrainerClient.client_id == auth_user.id)
        if trainer_id_filter is not None:
            stmt = stmt.where(TrainerClient.trainer_id == trainer_id_filter)

    order_col = getattr(TrainerClient, sort_by, None) if sort_by else None
    if order_col is not None:
        stmt = stmt.order_by(desc(order_col) if sort_desc else asc(order_col))
    else:
        stmt = stmt.order_by(desc(TrainerClient.id))

    if limit is not None:
        stmt = stmt.limit(limit)
    if offset is not None:
        stmt = stmt.offset(offset)

    result = await session.execute(stmt)
    rows = list(result.scalars().all())
    return [_row_to_dict(r) for r in rows]


async def _get_row(session: AsyncSession, link_id: int) -> TrainerClient | None:
    return await session.get(TrainerClient, link_id)


def _can_view_row(auth_user: PgUser, row: TrainerClient) -> bool:
    role = _normalize_role(auth_user.role)
    if role == UserRole.admin:
        return True

    if role == UserRole.trainer:
        return row.trainer_id == auth_user.id

    return row.client_id == auth_user.id


def _can_delete_row(auth_user: PgUser, row: TrainerClient) -> bool:
    return _can_view_row(auth_user, row)


async def postgres_get_trainer_client(
    session: AsyncSession,
    link_id: int,
    auth_user: PgUser,
) -> dict[str, int]:
    """Одна связь по `link_id`, если текущий пользователь имеет право её видеть."""
    row = await _get_row(session, link_id)
    if row is None or not _can_view_row(auth_user, row):
        raise HTTPException(status_code=404, detail="Not found")

    return _row_to_dict(row)


async def postgres_create_trainer_client(
    session: AsyncSession,
    body: TrainerClientCreate,
    auth_user: PgUser,
) -> dict[str, int]:
    """Создаёт строку trainer_clients (права: admin или trainer)."""
    role = _normalize_role(auth_user.role)
    if role == UserRole.user:
        raise HTTPException(
            status_code=403,
            detail="Только тренер или admin может создавать связь",
        )

    if role == UserRole.admin:
        tid = body.trainer_id
        if tid is None:
            raise HTTPException(
                status_code=422,
                detail="Для admin укажите trainer_id в теле запроса",
            )
        trainer_id = tid
    else:
        if body.trainer_id is not None and body.trainer_id != auth_user.id:
            raise HTTPException(
                status_code=403,
                detail="Тренер не может назначать связь от имени другого тренера",
            )
        trainer_id = auth_user.id

    if trainer_id == body.client_id:
        raise HTTPException(
            status_code=400,
            detail="trainer_id и client_id не должны совпадать",
        )

    tr = await session.get(PgUser, trainer_id)
    cl = await session.get(PgUser, body.client_id)
    if tr is None or cl is None:
        raise HTTPException(
            status_code=400, detail="Тренер или клиент не найден в users"
        )

    row = TrainerClient(trainer_id=trainer_id, client_id=body.client_id)
    session.add(row)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Такая связь тренер–клиент уже существует",
            other_detail="Не удалось сохранить связь тренер–клиент",
        )

    await session.refresh(row)
    await invalidate_trainer_clients_cache(row.trainer_id, row.client_id, auth_user.id)
    return _row_to_dict(row)


async def postgres_delete_trainer_client(
    session: AsyncSession,
    link_id: int,
    auth_user: PgUser,
) -> dict[str, str | int]:
    """Удаляет связь по id при наличии прав (как у чтения)."""
    row = await _get_row(session, link_id)
    if row is None or not _can_delete_row(auth_user, row):
        raise HTTPException(status_code=404, detail="Not found")

    trainer_id, client_id = row.trainer_id, row.client_id
    await session.delete(row)
    await session.commit()
    await invalidate_trainer_clients_cache(trainer_id, client_id, auth_user.id)

    return {"message": "ok", "id": link_id}
