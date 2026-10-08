"""Exercise catalog endpoints with duplicate name check on create."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, UploadFile, File

from crud.filter_schema import CommonListQuery, OutputSettings, SortDirectionEnum
from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from cache_groups import CacheGroup, mark_cache_group
from utils.cache import CACHE_EXERCISE_EXPIRE_SECONDS, cached_get, ns
from schemas.exercise_in_catalog import (
    ExerciseInCatalogCreate,
    ExerciseInCatalogCreateResponse,
    ExerciseInCatalogDeleteResponse,
    ExerciseInCatalogImageDeleteResponse,
    ExerciseInCatalogImageUploadResponse,
    ExerciseInCatalogOut,
    ExerciseInCatalogPatch,
    ExerciseInCatalogPatchResponse,
    ExerciseInCatalogReplace,
    ExerciseInCatalogReplaceResponse,
)
from schemas.exercise_catalog_log_summary import (
    CatalogExerciseSetHistoryOut,
    CatalogLogSummaryOut,
)
from schemas.exercise_library import PublishExerciseResponse, UnpublishExerciseResponse
from services.postgres.public_exercise_actions import (
    publish_catalog_exercise,
    unpublish_catalog_exercise,
)
from services.postgres.exercise_catalog_log_summary import (
    postgres_catalog_exercise_set_history,
    postgres_catalog_log_summary,
)
from services.postgres.exercise_in_catalog_actions import (
    postgres_create_exercise,
    postgres_delete_exercise,
    postgres_get_exercise,
    postgres_list_exercises,
    postgres_patch_exercise,
    postgres_replace_exercise,
    postgres_delete_exercise_image,
    postgres_upload_exercise_image,
)

router = APIRouter(prefix="/exercises_in_catalog", tags=["exercises_in_catalog"])


@router.post("/", response_model=ExerciseInCatalogCreateResponse)
async def create_exercise(
    exercise_data: ExerciseInCatalogCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """
    Создание упражнения в каталоге текущего пользователя.
    Ошибка 400 при дублировании имени в рамках своего каталога.
    """
    return await postgres_create_exercise(session, exercise_data, auth_user)


@router.get("/", response_model=list[ExerciseInCatalogOut])
@mark_cache_group(CacheGroup.HOT0)
async def list_exercises(
    session: db_session,
    output_settings: Annotated[OutputSettings, Depends()],
    common: Annotated[CommonListQuery, Depends()],
    auth_user: Annotated[User, Depends(get_current_user)],
    muscle_group: Annotated[
        str | None, Query(description="Точное совпадение поля muscle_group")
    ] = None,
):
    """Список упражнений каталога (свой / подопечных / все для admin) с пагинацией и поиском."""
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

    return await postgres_list_exercises(
        session,
        auth_user,
        sort_by=output_settings.sort_by,
        sort_desc=sort_desc,
        limit=output_settings.limit,
        offset=output_settings.offset,
        common=common,
        muscle_group=muscle_group,
    )


@router.get("/log_summary", response_model=CatalogLogSummaryOut)
@mark_cache_group(CacheGroup.HOT0)
async def catalog_log_summary(
    session: db_session,
    common: Annotated[CommonListQuery, Depends()],
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """
    Сводные цифры для экрана каталога и агрегаты по каждому упражнению из журнала подходов
    (тренировки текущего пользователя).
    """
    return await postgres_catalog_log_summary(session, auth_user, owner=common.owner)


@router.get("/{item_id}/set_history", response_model=CatalogExerciseSetHistoryOut)
@mark_cache_group(CacheGroup.HOT0)
async def catalog_exercise_set_history(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """История рабочих подходов по дням для одного упражнения каталога."""
    return await postgres_catalog_exercise_set_history(
        session,
        auth_user,
        item_id=item_id,
    )


@router.get("/{item_id}", response_model=ExerciseInCatalogOut)
@cached_get(
    namespace=ns.get_exercise_catalog,
    expire=CACHE_EXERCISE_EXPIRE_SECONDS,
    cache_group=CacheGroup.COLD1,
)
async def get_exercise(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Одно упражнение по id (только если доступен по правилам каталога)."""
    return await postgres_get_exercise(session, item_id, auth_user)


@router.put("/{item_id}", response_model=ExerciseInCatalogReplaceResponse)
async def replace_exercise(
    item_id: Annotated[int, Path(ge=0)],
    data: ExerciseInCatalogReplace,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Полная замена полей записи (нужны все поля схемы, как при создании)."""
    return await postgres_replace_exercise(session, item_id, data, auth_user)


@router.patch("/{item_id}", response_model=ExerciseInCatalogPatchResponse)
async def patch_exercise(
    item_id: Annotated[int, Path(ge=0)],
    data: ExerciseInCatalogPatch,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Частичное обновление: только переданные в теле поля."""
    return await postgres_patch_exercise(session, item_id, data, auth_user)


@router.delete("/{item_id}", response_model=ExerciseInCatalogDeleteResponse)
async def delete_exercise(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    return await postgres_delete_exercise(session, item_id, auth_user)


@router.post("/{item_id}/publish", response_model=PublishExerciseResponse)
async def publish_exercise(
    item_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Опубликовать своё упражнение из каталога в общее пространство."""
    data = await publish_catalog_exercise(session, item_id, auth_user)
    return PublishExerciseResponse.model_validate(data)


@router.delete("/{item_id}/publish", response_model=UnpublishExerciseResponse)
async def unpublish_exercise(
    item_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """Снять упражнение с публикации (запись остаётся, is_active=false)."""
    await unpublish_catalog_exercise(session, item_id, auth_user)
    return UnpublishExerciseResponse()


@router.post("/{item_id}/image", response_model=ExerciseInCatalogImageUploadResponse)
async def upload_exercise_image(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> ExerciseInCatalogImageUploadResponse:
    """
    Загрузить свою картинку упражнения на локальное хранилище сервера.
    В поле `image` записи каталога сохраняется URL `/media/...`.
    """
    data = await postgres_upload_exercise_image(session, item_id, file, auth_user)
    return ExerciseInCatalogImageUploadResponse.model_validate(data)


@router.delete("/{item_id}/image", response_model=ExerciseInCatalogImageDeleteResponse)
async def delete_exercise_image(
    item_id: Annotated[int, Path(ge=0)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
) -> ExerciseInCatalogImageDeleteResponse:
    """
    Удалить изображение упражнения: файл с диска и сброс поля `image`.
    """
    data = await postgres_delete_exercise_image(session, item_id, auth_user)
    return ExerciseInCatalogImageDeleteResponse.model_validate(data)
