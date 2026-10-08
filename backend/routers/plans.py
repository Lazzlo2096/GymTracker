"""Планы тренировок: программы пользователя в PostgreSQL."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from cache_groups import CacheGroup, mark_cache_group
from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.plans import PlannedSessionOut, ProgramCreate, ProgramOut, ProgramUpdate
from schemas.utils.common_parts import ApiMessage
from services.postgres.planned_sessions_actions import postgres_list_planned_sessions
from services.postgres.training_program_actions import (
    postgres_create_training_program,
    postgres_delete_training_program,
    postgres_get_current_training_program,
    postgres_get_training_program,
    postgres_list_training_programs,
    postgres_update_training_program,
)

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get(
    "/scheduled",
    response_model=list[PlannedSessionOut],
    response_model_exclude_none=True,
    summary="Расписание",
    description=(
        "Запланированные сессии для вкладки «Расписание» на /plans: "
        "генерируются из текущей программы (is_current) и шаблонов тренировок. "
        "Без текущей программы — пустой список."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def list_scheduled_sessions(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> list[PlannedSessionOut]:
    return await postgres_list_planned_sessions(session, auth_user)


@router.get(
    "/program/current",
    response_model=ProgramOut,
    response_model_exclude_none=True,
    summary="Текущая программа",
    description=(
        "Возвращает активную программу пользователя (training_programs.is_current). "
        "404, если текущая программа не выбрана."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def get_current_program(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> ProgramOut:
    return await postgres_get_current_training_program(session, auth_user)


@router.get(
    "/program",
    response_model=list[ProgramOut],
    response_model_exclude_none=True,
    summary="Каталог программ пользователя",
    description=(
        "Все программы текущего пользователя из training_programs. "
        "Текущая активная — GET /plans/program/current."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def list_programs(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> list[ProgramOut]:
    return await postgres_list_training_programs(session, auth_user)


@router.get(
    "/program/{program_id}",
    response_model=ProgramOut,
    response_model_exclude_none=True,
    summary="Программа по id",
    description="Одна программа текущего пользователя из training_programs.",
)
@mark_cache_group(CacheGroup.NONE)
async def get_program(
    program_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> ProgramOut:
    return await postgres_get_training_program(session, auth_user, program_id)


@router.post(
    "/program",
    response_model=ProgramOut,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    summary="Создать программу тренировок",
    description=(
        "Сохраняет программу в training_programs.program_json для текущего пользователя. "
        "Тело — тот же discriminated union, что и в ответе GET, но без поля id "
        "(id назначает сервер). Опционально is_current=true снимает флаг с прежней текущей программы."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def create_program(
    body: ProgramCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    is_current: Annotated[
        bool,
        Query(description="Сделать созданную программу текущей для пользователя"),
    ] = False,
) -> ProgramOut:
    return await postgres_create_training_program(
        session,
        body,
        auth_user,
        is_current=is_current,
    )


@router.patch(
    "/program/{program_id}",
    response_model=ProgramOut,
    response_model_exclude_none=True,
    summary="Обновить программу тренировок",
    description=(
        "Полная замена program_json (discriminated union без id). "
        "Query is_current=true — сделать программу текущей; false — снять флаг текущей."
    ),
)
@mark_cache_group(CacheGroup.NONE)
async def update_program(
    program_id: Annotated[int, Path(ge=1)],
    body: ProgramUpdate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    is_current: Annotated[
        bool | None,
        Query(
            description=(
                "true — сделать текущей; false — снять флаг текущей; "
                "не передавать — не менять is_current"
            )
        ),
    ] = None,
) -> ProgramOut:
    return await postgres_update_training_program(
        session,
        program_id,
        body,
        auth_user,
        is_current=is_current,
    )


@router.delete(
    "/program/{program_id}",
    response_model=ApiMessage,
    summary="Удалить программу тренировок",
)
@mark_cache_group(CacheGroup.NONE)
async def delete_program(
    program_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> ApiMessage:
    await postgres_delete_training_program(session, program_id, auth_user)
    return ApiMessage()
