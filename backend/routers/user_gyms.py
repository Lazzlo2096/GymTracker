"""API фитнес-залов пользователя."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Path, UploadFile, status

from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from cache_groups import CacheGroup
from utils.cache import cached_get, ns
from schemas.user_gym import (
    UserGymCreate,
    UserGymCreateResponse,
    UserGymOut,
    UserGymPatch,
)
from schemas.utils.common_parts import ApiMessage
from services.postgres.user_gym_actions import (
    postgres_append_user_gym_gallery,
    postgres_create_user_gym,
    postgres_delete_user_gym,
    postgres_list_user_gyms,
    postgres_patch_user_gym,
)

router = APIRouter(prefix="/user_gyms", tags=["user_gyms"])


@router.get("/", response_model=list[UserGymOut])
@cached_get(namespace=ns.list_user_gyms, cache_group=CacheGroup.WARM1)
async def list_user_gyms(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Список сохранённых залов текущего пользователя."""
    return await postgres_list_user_gyms(session, auth_user)


@router.post(
    "/", response_model=UserGymCreateResponse, status_code=status.HTTP_201_CREATED
)
async def create_user_gym(
    body: UserGymCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """
    Создать зал по имени; если имя уже есть у пользователя — вернуть существующую запись.
    """
    return await postgres_create_user_gym(session, body, auth_user)


@router.patch("/{gym_id}", response_model=UserGymOut)
async def patch_user_gym(
    gym_id: Annotated[int, Path(ge=1)],
    body: UserGymPatch,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Обновить сохранённый зал."""
    return await postgres_patch_user_gym(session, gym_id, body, auth_user)


@router.delete("/{gym_id}", response_model=ApiMessage)
async def delete_user_gym(
    gym_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> ApiMessage:
    """Архивировать зал (скрыть из списков; тренировки сохраняют привязку)."""
    await postgres_delete_user_gym(session, gym_id, auth_user)
    return ApiMessage()


@router.post("/{gym_id}/gallery", response_model=UserGymOut)
async def upload_user_gym_gallery(
    gym_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
):
    """Загрузить фото в галерею зала (до 6 снимков)."""
    return await postgres_append_user_gym_gallery(session, gym_id, file, auth_user)
