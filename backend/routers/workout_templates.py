"""API шаблонов тренировок (библиотека планов)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, status

from cache_groups import CacheGroup
from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.utils.common_parts import ApiMessage
from schemas.workout_template_api import (
    WorkoutTemplateCreate,
    WorkoutTemplateDetailOut,
    WorkoutTemplateListOut,
    WorkoutTemplatePatch,
)
from services.postgres.workout_template_actions import (
    postgres_create_workout_template,
    postgres_delete_workout_template,
    postgres_get_workout_template,
    postgres_list_workout_templates,
    postgres_patch_workout_template,
)
from utils.cache import cached_get, ns

router = APIRouter(prefix="/workout_templates", tags=["workout_templates"])


@router.get("/", response_model=WorkoutTemplateListOut)
@cached_get(namespace=ns.list_workout_templates, cache_group=CacheGroup.WARM1)
async def list_workout_templates(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Список шаблонов для вкладки «Шаблоны» на /plans."""
    items = await postgres_list_workout_templates(session, auth_user)
    return WorkoutTemplateListOut(items=items)


@router.get("/{template_id}", response_model=WorkoutTemplateDetailOut)
@cached_get(namespace=ns.get_workout_template, cache_group=CacheGroup.WARM1)
async def get_workout_template(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    template_id: Annotated[int, Path(ge=1)],
):
    """Деталь шаблона для экрана /plan-template/[id]."""
    return await postgres_get_workout_template(session, auth_user, template_id)


@router.post(
    "/",
    response_model=WorkoutTemplateDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_workout_template(
    body: WorkoutTemplateCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Создать шаблон тренировки."""
    return await postgres_create_workout_template(session, body, auth_user)


@router.patch("/{template_id}", response_model=WorkoutTemplateDetailOut)
async def patch_workout_template(
    template_id: Annotated[int, Path(ge=1)],
    body: WorkoutTemplatePatch,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Обновить шаблон тренировки."""
    return await postgres_patch_workout_template(session, template_id, body, auth_user)


@router.delete("/{template_id}", response_model=ApiMessage)
async def delete_workout_template(
    template_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> ApiMessage:
    """Удалить шаблон тренировки."""
    await postgres_delete_workout_template(session, template_id, auth_user)
    return ApiMessage()
