"""CRUD /api/v1/user_weights/ (PostgreSQL)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from cache_groups import CacheGroup
from crud.filter_schema import CommonListQuery, OutputSettings, SortDirectionEnum
from dependencies.auth import current_user, get_current_user
from dependencies.db_session import db_session
from project_config import settings
from schemas.user_weights import (
    UserWeightCrudCreate,
    UserWeightCrudFilter,
    UserWeightCrudUpdate,
)
from schemas.utils.common_parts import ApiMessage
from services.postgres.user_weights_crud_actions import (
    create_user_weight,
    delete_user_weight,
    get_user_weight,
    list_user_weights,
    update_user_weight,
)
from utils.cache import cached_get, invalidate_user_weights_cache

router = APIRouter(
    prefix="/user_weights",
    tags=["user_weights"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create(
    item: UserWeightCrudCreate,
    session: db_session,
    auth_user: current_user,
) -> dict[str, int]:
    result, owner_id = await create_user_weight(
        session,
        auth_user=auth_user,
        requested_user_id=item.user_id,
        weight_kg=float(item.weight_kg),
        measured_at=item.measured_at,
        body_fat_percent=(
            float(item.body_fat_percent)
            if item.body_fat_percent is not None
            else None
        ),
        note=item.note,
    )
    await invalidate_user_weights_cache(owner_id)
    return result


@router.get("/")
@cached_get(
    namespace=settings.cache_namespaces.list_user_weights_crud,
    cache_group=CacheGroup.WARM1,
)
async def list_all(
    session: db_session,
    auth_user: current_user,
    filters: UserWeightCrudFilter = Depends(),
    output_settings: OutputSettings = Depends(),
    common: CommonListQuery = Depends(),
):
    if (
        common.date_from is not None
        and common.date_to is not None
        and common.date_from > common.date_to
    ):
        raise HTTPException(
            status_code=400,
            detail="date_from не может быть позже date_to",
        )
    sort_desc = output_settings.sort_direction == SortDirectionEnum.DESC
    return await list_user_weights(
        session,
        auth_user,
        filters.model_dump(exclude_none=True),
        output_settings.sort_by,
        sort_desc,
        output_settings.limit,
        output_settings.offset,
        common,
    )


@router.get("/{item_id}")
async def get_one(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: current_user,
):
    row = await get_user_weight(session, auth_user, item_id)
    if row is not None:
        return row
    raise HTTPException(status_code=404, detail="Not found")


@router.put("/{item_id}", response_model=ApiMessage)
async def update(
    item_id: Annotated[int, Path(ge=0)],
    data: UserWeightCrudUpdate,
    session: db_session,
    auth_user: current_user,
) -> ApiMessage:
    owner_id = await update_user_weight(
        session, auth_user, item_id, data.model_dump(exclude_unset=True)
    )
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Not found")
    await invalidate_user_weights_cache(owner_id)
    return ApiMessage()


@router.delete("/{item_id}", response_model=ApiMessage)
async def delete(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: current_user,
) -> ApiMessage:
    owner_id = await delete_user_weight(session, auth_user, item_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Not found")
    await invalidate_user_weights_cache(owner_id)
    return ApiMessage()
