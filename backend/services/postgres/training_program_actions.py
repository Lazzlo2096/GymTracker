"""Действия с программами тренировок пользователя (PostgreSQL)."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres.training_program import TrainingProgram
from db.models.postgres.user import User as PgUser
from schemas.plans import (
    ProgramCreate,
    ProgramOut,
    normalize_legacy_program_json,
    program_out_adapter,
)


def training_program_row_to_out(row: TrainingProgram) -> ProgramOut:
    """Собрать ответ API из строки БД (id берётся из PK, не из черновика JSON)."""
    payload = normalize_legacy_program_json(dict(row.program_json))
    payload["id"] = row.id
    return program_out_adapter.validate_python(payload)


def _program_json_from_body(body: ProgramCreate, program_id: int) -> dict:
    payload = body.model_dump(mode="json")
    payload["id"] = program_id
    return payload


async def _load_training_program(
    session: AsyncSession,
    user_id: int,
    program_id: int,
) -> TrainingProgram | None:
    result = await session.execute(
        select(TrainingProgram).where(
            TrainingProgram.id == program_id,
            TrainingProgram.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_training_program_or_404(
    session: AsyncSession,
    user_id: int,
    program_id: int,
) -> TrainingProgram:
    row = await _load_training_program(session, user_id, program_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Программа не найдена",
        )
    return row


async def postgres_list_training_programs(
    session: AsyncSession,
    auth_user: PgUser,
) -> list[ProgramOut]:
    """Все программы пользователя из training_programs."""
    result = await session.execute(
        select(TrainingProgram)
        .where(TrainingProgram.user_id == auth_user.id)
        .order_by(TrainingProgram.id.asc())
    )
    rows = result.scalars().all()
    return [training_program_row_to_out(row) for row in rows]


async def postgres_get_training_program(
    session: AsyncSession,
    auth_user: PgUser,
    program_id: int,
) -> ProgramOut:
    """Одна программа пользователя по id."""
    row = await _get_training_program_or_404(session, auth_user.id, program_id)
    return training_program_row_to_out(row)


async def postgres_get_current_training_program(
    session: AsyncSession,
    auth_user: PgUser,
) -> ProgramOut:
    """Текущая программа пользователя (is_current=true)."""
    result = await session.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == auth_user.id,
            TrainingProgram.is_current.is_(True),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Текущая программа не выбрана",
        )
    return training_program_row_to_out(row)


async def _clear_current_program_flag(
    session: AsyncSession,
    user_id: int,
    *,
    except_program_id: int | None = None,
) -> None:
    stmt = update(TrainingProgram).where(
        TrainingProgram.user_id == user_id,
        TrainingProgram.is_current.is_(True),
    )
    if except_program_id is not None:
        stmt = stmt.where(TrainingProgram.id != except_program_id)
    await session.execute(stmt.values(is_current=False))


async def postgres_create_training_program(
    session: AsyncSession,
    body: ProgramCreate,
    auth_user: PgUser,
    *,
    is_current: bool = False,
) -> ProgramOut:
    """Сохранить программу в training_programs.program_json."""
    if is_current:
        await _clear_current_program_flag(session, auth_user.id)

    row = TrainingProgram(
        user_id=auth_user.id,
        program_json=body.model_dump(mode="json"),
        is_current=is_current,
    )
    session.add(row)
    await session.flush()

    row.program_json = _program_json_from_body(body, row.id)

    await session.commit()
    await session.refresh(row)
    return training_program_row_to_out(row)


async def postgres_update_training_program(
    session: AsyncSession,
    program_id: int,
    body: ProgramCreate,
    auth_user: PgUser,
    *,
    is_current: bool | None = None,
) -> ProgramOut:
    """Заменить program_json; опционально сделать программу текущей."""
    row = await _get_training_program_or_404(session, auth_user.id, program_id)

    if is_current:
        await _clear_current_program_flag(
            session, auth_user.id, except_program_id=program_id
        )
        row.is_current = True
    elif is_current is False:
        row.is_current = False

    row.program_json = _program_json_from_body(body, row.id)

    await session.commit()
    await session.refresh(row)
    return training_program_row_to_out(row)


async def postgres_delete_training_program(
    session: AsyncSession,
    program_id: int,
    auth_user: PgUser,
) -> None:
    """Удалить программу пользователя."""
    row = await _get_training_program_or_404(session, auth_user.id, program_id)
    await session.delete(row)
    await session.commit()
