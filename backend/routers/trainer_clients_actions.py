"""API связей тренер ↔ подопечный (таблица trainer_clients)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from crud.filter_schema import OutputSettings, SortDirectionEnum
from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from cache_groups import CacheGroup
from utils.cache import cached_get, ns
from schemas.trainer_clients import (
    TrainerClientCreate,
    TrainerClientDeleteResponse,
    TrainerClientOut,
)
from services.postgres.trainer_clients_actions import (
    postgres_create_trainer_client,
    postgres_delete_trainer_client,
    postgres_get_trainer_client,
    postgres_list_trainer_clients,
)

router = APIRouter(prefix="/trainer_clients", tags=["trainer_clients"])


@router.get("/", response_model=list[TrainerClientOut])
@cached_get(namespace=ns.list_trainer_clients, cache_group=CacheGroup.WARM1)
async def list_trainer_clients(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    output_settings: Annotated[OutputSettings, Depends()],
    trainer_id: Annotated[
        int | None, Query(description="Фильтр по id тренера (admin / свой client)")
    ] = None,
    client_id: Annotated[
        int | None, Query(description="Фильтр по id подопечного (admin / свой trainer)")
    ] = None,
):
    """
    Список связей (массив).

    - **admin** — все строки, опционально `trainer_id` и/или `client_id`.
    - **trainer** — только свои связи (`trainer_id` = вы), опционально `client_id`.
    - **user** — связи, где вы подопечный (`client_id` = вы), опционально `trainer_id`.
    """
    sort_desc = output_settings.sort_direction == SortDirectionEnum.DESC
    return await postgres_list_trainer_clients(
        session,
        auth_user,
        trainer_id_filter=trainer_id,
        client_id_filter=client_id,
        sort_by=output_settings.sort_by,
        sort_desc=sort_desc,
        limit=output_settings.limit,
        offset=output_settings.offset,
    )


@router.get("/{link_id}", response_model=TrainerClientOut)
@cached_get(namespace=ns.get_trainer_client, cache_group=CacheGroup.WARM1)
async def get_trainer_client(
    link_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    return await postgres_get_trainer_client(session, link_id, auth_user)


@router.post("/", response_model=TrainerClientOut, status_code=status.HTTP_201_CREATED)
async def create_trainer_client(
    body: TrainerClientCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """
    Создать связь тренер → клиент.

    - **trainer**: тело `{"client_id": N}` (вы становитесь тренером).
    - **admin**: `{"trainer_id": T, "client_id": C}`.
    """
    return await postgres_create_trainer_client(session, body, auth_user)


@router.delete("/{link_id}", response_model=TrainerClientDeleteResponse)
async def delete_trainer_client(
    link_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> TrainerClientDeleteResponse:
    """Удалить связь (тренер, подопечный или admin)."""
    data = await postgres_delete_trainer_client(session, link_id, auth_user)
    return TrainerClientDeleteResponse.model_validate(data)
