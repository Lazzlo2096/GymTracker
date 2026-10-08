"""Каталог упражнений для PostgreSQL (вызывается из routers.exercise_in_catalog_actions)."""

from pathlib import Path
import uuid

from fastapi import HTTPException
from fastapi import UploadFile

from crud.filter_schema import CommonListQuery
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from project_config import settings
from db.models.postgres import ExerciseInCatalog, User as PgUser
from db.models.postgres.user_gym import UserGym
from db.repositories.postgres.exercise_catalog_repository import (
    find_by_name_for_user,
    list_exercises,
)
from schemas.exercise_in_catalog import (
    ExerciseInCatalogCreate,
    ExerciseInCatalogPatch,
    ExerciseInCatalogReplace,
)
from services.postgres.catalog_access import (
    can_access_catalog_owner,
    resolve_catalog_scope_user_ids,
)
from utils.cache import invalidate_catalog_cache
from utils.db_errors import rollback_and_raise_integrity


def _user_gym_brief(row: ExerciseInCatalog) -> dict | None:
    if not row.user_gym_id:
        return None
    ug = row.user_gym
    if ug is None:
        return None
    return {"id": ug.id, "name": ug.name}


def _catalog_row_to_dict(row: ExerciseInCatalog) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "name": row.name,
        "notes": row.notes,
        "muscle_group": row.muscle_group,
        "exercise_type": row.exercise_type,
        "machine_location": row.machine_location,
        "machine_settings": row.machine_settings,
        "icon": row.icon,
        "image": row.image,
        "user_gym_id": row.user_gym_id,
        "user_gym": _user_gym_brief(row),
        "created_at": row.created_at,
    }


async def _assert_catalog_user_gym(
    session: AsyncSession,
    *,
    user_id: int,
    user_gym_id: int | None,
) -> None:
    if user_gym_id is None:
        return
    ug = await session.get(UserGym, user_gym_id)
    if not ug or ug.user_id != user_id or ug.is_archived:
        raise HTTPException(status_code=400, detail="Указанный зал не найден")


async def postgres_create_exercise(
    session: AsyncSession,
    exercise_data: ExerciseInCatalogCreate,
    auth_user: PgUser,
) -> dict:
    if await find_by_name_for_user(session, exercise_data.name, auth_user.id):
        raise HTTPException(
            status_code=400,
            detail="Exercise with this name already exists",
        )

    row = ExerciseInCatalog(
        user_id=auth_user.id,
        name=exercise_data.name,
        notes=exercise_data.notes,
        muscle_group=exercise_data.muscle_group,
        exercise_type=(
            exercise_data.exercise_type.value
            if exercise_data.exercise_type is not None
            else None
        ),
        machine_location=exercise_data.machine_location,
        machine_settings=exercise_data.machine_settings,
        icon=exercise_data.icon,
        image=exercise_data.image,
    )
    session.add(row)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Exercise with this name already exists",
            other_detail="Could not save exercise",
        )
    await session.refresh(row)
    await invalidate_catalog_cache(row.user_id)

    return {
        "message": "Exercise created",
        "id": row.id,
        "user_id": row.user_id,
        "name": row.name,
        "notes": row.notes,
        "muscle_group": row.muscle_group,
        "exercise_type": row.exercise_type,
        "machine_location": row.machine_location,
        "machine_settings": row.machine_settings,
        "icon": row.icon,
        "image": row.image,
        "created_at": row.created_at,
    }


async def postgres_list_exercises(
    session: AsyncSession,
    auth_user: PgUser,
    *,
    sort_by: str | None = None,
    sort_desc: bool = True,
    limit: int | None = None,
    offset: int | None = None,
    common: CommonListQuery | None = None,
    muscle_group: str | None = None,
) -> list[dict]:
    common = common or CommonListQuery()
    scope = await resolve_catalog_scope_user_ids(session, auth_user, common.owner)
    rows = await list_exercises(
        session,
        scope_user_ids=scope,
        sort_by=sort_by,
        sort_desc=sort_desc,
        limit=limit,
        offset=offset,
        common=common,
        muscle_group=muscle_group,
    )
    return [_catalog_row_to_dict(r) for r in rows]


async def postgres_get_exercise(
    session: AsyncSession,
    item_id: int,
    auth_user: PgUser,
) -> dict:
    row = await session.get(
        ExerciseInCatalog,
        item_id,
        options=[selectinload(ExerciseInCatalog.user_gym)],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if not await can_access_catalog_owner(session, auth_user, row.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    return _catalog_row_to_dict(row)


async def postgres_replace_exercise(
    session: AsyncSession,
    item_id: int,
    data: ExerciseInCatalogReplace,
    auth_user: PgUser,
) -> dict:
    """PUT: полная замена полей записи (как в ExerciseInCatalogScheme)."""
    row = await session.get(ExerciseInCatalog, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if not await can_access_catalog_owner(session, auth_user, row.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    payload = data.model_dump()
    if payload["name"] != row.name:
        if await find_by_name_for_user(session, payload["name"], row.user_id):
            raise HTTPException(
                status_code=400,
                detail="Exercise with this name already exists",
            )

    row.name = payload["name"]
    row.notes = payload["notes"]
    row.muscle_group = payload["muscle_group"]
    row.exercise_type = (
        payload["exercise_type"].value
        if payload.get("exercise_type") is not None
        else None
    )
    row.machine_location = payload["machine_location"]
    row.machine_settings = payload["machine_settings"]
    row.icon = payload["icon"]
    row.image = payload["image"]

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Exercise with this name already exists",
            other_detail="Could not save exercise",
        )
    await invalidate_catalog_cache(row.user_id)
    return {"status": "updated"}


async def postgres_patch_exercise(
    session: AsyncSession,
    item_id: int,
    data: ExerciseInCatalogPatch,
    auth_user: PgUser,
) -> dict:
    """PATCH: только переданные поля."""
    row = await session.get(ExerciseInCatalog, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if not await can_access_catalog_owner(session, auth_user, row.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    patch = data.model_dump(exclude_unset=True)
    if not patch:
        return {"status": "updated"}

    if "name" in patch and patch["name"] != row.name:
        if await find_by_name_for_user(session, patch["name"], row.user_id):
            raise HTTPException(
                status_code=400,
                detail="Exercise with this name already exists",
            )

    if "user_gym_id" in patch:
        await _assert_catalog_user_gym(
            session,
            user_id=row.user_id,
            user_gym_id=patch["user_gym_id"],
        )

    for k, v in patch.items():
        if not hasattr(row, k):
            continue
        if k == "exercise_type":
            setattr(
                row,
                k,
                v.value if v is not None and hasattr(v, "value") else v,
            )
        else:
            setattr(row, k, v)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Exercise with this name already exists",
            other_detail="Could not save exercise",
        )
    await invalidate_catalog_cache(row.user_id)
    return {"status": "updated"}


async def postgres_delete_exercise(
    session: AsyncSession, item_id: int, auth_user: PgUser
) -> dict:
    row = await session.get(ExerciseInCatalog, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if not await can_access_catalog_owner(session, auth_user, row.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    await session.delete(row)
    await session.commit()
    await invalidate_catalog_cache(row.user_id)

    return {"status": "deleted"}


async def postgres_upload_exercise_image(
    session: AsyncSession,
    item_id: int,
    file: UploadFile,
    auth_user: PgUser,
) -> dict[str, str]:
    row = await session.get(ExerciseInCatalog, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if not await can_access_catalog_owner(session, auth_user, row.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")

    ext = Path(file.filename or "image.bin").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        # Если расширение отсутствует/неподдерживаемое, fallback на .jpg
        ext = ".jpg"

    exercise_dir = Path(settings.MEDIA_ROOT) / "exercises" / str(row.user_id)
    exercise_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{row.id}_{uuid.uuid4().hex}{ext}"
    target = exercise_dir / file_name

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Пустой файл")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 10MB)")

    target.write_bytes(content)
    rel_url = (
        f"{settings.MEDIA_URL_PREFIX.rstrip('/')}/exercises/{row.user_id}/{file_name}"
    )
    row.image = rel_url

    await session.commit()
    await invalidate_catalog_cache(row.user_id)

    return {"message": "ok", "image": rel_url}


def _unlink_exercise_image_file(image_url: str | None) -> None:
    if not image_url:
        return
    prefix = settings.MEDIA_URL_PREFIX.rstrip("/")
    if not image_url.startswith(prefix):
        return
    rel = image_url[len(prefix) :].lstrip("/")
    target = Path(settings.MEDIA_ROOT) / rel
    try:
        target.unlink(missing_ok=True)
    except OSError:
        pass


async def postgres_delete_exercise_image(
    session: AsyncSession,
    item_id: int,
    auth_user: PgUser,
) -> dict[str, str]:
    row = await session.get(ExerciseInCatalog, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if not await can_access_catalog_owner(session, auth_user, row.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    _unlink_exercise_image_file(row.image)
    row.image = None
    await session.commit()
    await invalidate_catalog_cache(row.user_id)
    return {"message": "ok", "status": "deleted"}
