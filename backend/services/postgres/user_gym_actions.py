"""Действия с фитнес-залами пользователя (PostgreSQL)."""

from datetime import date, datetime, timezone
from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from project_config import settings
from db.models.postgres.user import User as PgUser
from db.models.postgres.user_gym import UserGym
from db.models.postgres.workout import Workout
from schemas.user_gym import UserGymCreate, UserGymOut, UserGymPatch
from utils.cache import invalidate_user_gyms_cache
from utils.db_errors import rollback_and_raise_integrity
from services.postgres.user_profile_satellites import ensure_user_profile_satellites


def _normalize_tags(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []

    out: list[str] = []
    for x in raw[:20]:
        if isinstance(x, str) and (s := x.strip()):
            out.append(s[:64])

    return out


def _upload_is_image(file: UploadFile, ext: str) -> bool:
    """Проверка типа файла (в т.ч. web multipart без image/*)."""
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct.startswith("image/"):
        return True
    if ct in ("", "application/octet-stream", "binary/octet-stream"):
        return ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    return False


def _normalize_gallery(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []

    out: list[str] = []
    for x in raw[:6]:
        if isinstance(x, str) and (s := x.strip()):
            out.append(s[:2048])

    return out


def _row_to_out(
    row: UserGym,
    *,
    visit_count: int = 0,
    last_workout_date: date | None = None,
) -> UserGymOut:
    return UserGymOut(
        id=row.id,
        user_id=row.user_id,
        created_at=row.created_at,
        name=row.name,
        address=row.address,
        is_favorite=bool(row.is_favorite),
        is_archived=bool(row.is_archived),
        rating=row.rating,
        review_text=row.review_text,
        review_updated_at=row.review_updated_at,
        last_visited_at=row.last_visited_at,
        tags=_normalize_tags(row.tags),
        gallery_urls=_normalize_gallery(row.gallery_urls),
        visit_count=visit_count,
        last_workout_date=last_workout_date,
    )


async def _visit_stats(
    session: AsyncSession, user_id: int, gym_id: int
) -> tuple[int, date | None]:
    r = await session.execute(
        select(func.count(Workout.id), func.max(Workout.workout_date)).where(
            Workout.user_id == user_id,
            Workout.user_gym_id == gym_id,
        )
    )
    cnt, mx = r.one()
    d = mx if isinstance(mx, date) else None

    return int(cnt or 0), d


async def _create_response_payload(
    session: AsyncSession,
    row: UserGym,
    *,
    message: str,
) -> dict:
    vc, lwd = await _visit_stats(session, row.user_id, row.id)
    d = _row_to_out(row, visit_count=vc, last_workout_date=lwd).model_dump()
    d["message"] = message

    return d


async def postgres_list_user_gyms(
    session: AsyncSession, auth_user: PgUser
) -> list[UserGymOut]:
    """Список залов пользователя с числом тренировок и датой последней тренировки."""
    visit_subq = (
        select(
            Workout.user_gym_id.label("gym_id"),
            func.count(Workout.id).label("visit_count"),
            func.max(Workout.workout_date).label("last_workout_date"),
        )
        .where(Workout.user_id == auth_user.id, Workout.user_gym_id.isnot(None))
        .group_by(Workout.user_gym_id)
        .subquery()
    )

    stmt = (
        select(UserGym, visit_subq.c.visit_count, visit_subq.c.last_workout_date)
        .outerjoin(visit_subq, UserGym.id == visit_subq.c.gym_id)
        .where(UserGym.user_id == auth_user.id, UserGym.is_archived.is_(False))
        .order_by(UserGym.name.asc())
    )

    result = await session.execute(stmt)
    rows = result.all()

    return [
        _row_to_out(
            ug,
            visit_count=int(vc or 0),
            last_workout_date=lwd if isinstance(lwd, date) else None,
        )
        for ug, vc, lwd in rows
    ]


async def postgres_create_user_gym(
    session: AsyncSession,
    data: UserGymCreate,
    auth_user: PgUser,
) -> dict:
    """Создать зал или вернуть существующий с тем же именем (регистрозависимое совпадение)."""
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Имя зала не может быть пустым")

    result = await session.execute(
        select(UserGym).where(
            UserGym.user_id == auth_user.id,
            UserGym.name == name,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        if existing.is_archived:
            existing.is_archived = False
            existing.is_favorite = bool(data.is_favorite)
            existing.rating = data.rating
            existing.review_text = (data.review_text or "").strip() or None
            existing.last_visited_at = data.last_visited_at
            existing.tags = _normalize_tags(data.tags)
            existing.gallery_urls = _normalize_gallery(data.gallery_urls)
            if data.address is not None:
                existing.address = (data.address or "").strip() or None
            if existing.review_text:
                existing.review_updated_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(existing)
            await invalidate_user_gyms_cache(auth_user.id)
            return await _create_response_payload(
                session, existing, message="Зал восстановлен из архива"
            )
        return await _create_response_payload(
            session,
            existing,
            message="Такой зал уже есть в списке",
        )

    addr = (data.address or "").strip() or None
    row = UserGym(
        user_id=auth_user.id,
        name=name,
        address=addr,
        is_favorite=bool(data.is_favorite),
        rating=data.rating,
        review_text=(data.review_text or "").strip() or None,
        last_visited_at=data.last_visited_at,
        tags=_normalize_tags(data.tags),
        gallery_urls=_normalize_gallery(data.gallery_urls),
    )
    if row.review_text:
        row.review_updated_at = datetime.now(timezone.utc)

    session.add(row)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Зал с таким именем уже есть",
            other_detail="Не удалось сохранить зал",
        )
    await session.refresh(row)
    await invalidate_user_gyms_cache(auth_user.id)

    return await _create_response_payload(session, row, message="Зал создан")


async def postgres_patch_user_gym(
    session: AsyncSession,
    gym_id: int,
    data: UserGymPatch,
    auth_user: PgUser,
) -> UserGymOut:
    row = await session.get(UserGym, gym_id)
    if not row or row.user_id != auth_user.id:
        raise HTTPException(status_code=404, detail="Зал не найден")
    if row.is_archived:
        raise HTTPException(status_code=404, detail="Зал в архиве")

    patch = data.model_dump(exclude_unset=True)
    if not patch:
        vc, lwd = await _visit_stats(session, auth_user.id, gym_id)
        return _row_to_out(row, visit_count=vc, last_workout_date=lwd)

    if "name" in patch and patch["name"] != row.name:
        new_name = patch["name"].strip()
        dup = await session.execute(
            select(UserGym).where(
                UserGym.user_id == auth_user.id,
                UserGym.name == new_name,
                UserGym.id != gym_id,
                UserGym.is_archived.is_(False),
            )
        )
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Зал с таким именем уже есть")

        row.name = new_name

    if "address" in patch:
        row.address = (patch["address"] or "").strip() or None
    if "is_favorite" in patch:
        row.is_favorite = bool(patch["is_favorite"])
    if "rating" in patch:
        row.rating = patch["rating"]
    if "review_text" in patch:
        txt = (patch["review_text"] or "").strip() or None
        row.review_text = txt
        row.review_updated_at = datetime.now(timezone.utc) if txt else None
    if "last_visited_at" in patch:
        row.last_visited_at = patch["last_visited_at"]
    if "tags" in patch and patch["tags"] is not None:
        row.tags = _normalize_tags(patch["tags"])
    if "gallery_urls" in patch and patch["gallery_urls"] is not None:
        row.gallery_urls = _normalize_gallery(patch["gallery_urls"])
    if patch.get("is_archived") is True:
        row.is_archived = True
        row.is_favorite = False
        await ensure_user_profile_satellites(session, auth_user)
        if (
            auth_user.fitness_data
            and auth_user.fitness_data.preferred_user_gym_id == gym_id
        ):
            auth_user.fitness_data.preferred_user_gym_id = None

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Зал с таким именем уже есть",
            other_detail="Не удалось сохранить зал",
        )

    await session.refresh(row)
    await invalidate_user_gyms_cache(auth_user.id)
    vc, lwd = await _visit_stats(session, auth_user.id, gym_id)

    return _row_to_out(row, visit_count=vc, last_workout_date=lwd)


async def postgres_archive_user_gym(
    session: AsyncSession, gym_id: int, auth_user: PgUser
) -> UserGymOut:
    """Скрыть зал из списков; тренировки сохраняют ссылку user_gym_id."""
    row = await session.get(UserGym, gym_id)
    if not row or row.user_id != auth_user.id:
        raise HTTPException(status_code=404, detail="Зал не найден")
    if row.is_archived:
        vc, lwd = await _visit_stats(session, auth_user.id, gym_id)
        return _row_to_out(row, visit_count=vc, last_workout_date=lwd)

    row.is_archived = True
    row.is_favorite = False
    await ensure_user_profile_satellites(session, auth_user)
    if (
        auth_user.fitness_data
        and auth_user.fitness_data.preferred_user_gym_id == gym_id
    ):
        auth_user.fitness_data.preferred_user_gym_id = None

    await session.commit()
    await session.refresh(row)
    await invalidate_user_gyms_cache(auth_user.id)
    vc, lwd = await _visit_stats(session, auth_user.id, gym_id)
    return _row_to_out(row, visit_count=vc, last_workout_date=lwd)


async def postgres_delete_user_gym(
    session: AsyncSession, gym_id: int, auth_user: PgUser
) -> None:
    """Устарело: архивирует зал (совместимость DELETE)."""
    await postgres_archive_user_gym(session, gym_id, auth_user)


async def postgres_append_user_gym_gallery(
    session: AsyncSession,
    gym_id: int,
    file: UploadFile,
    auth_user: PgUser,
) -> UserGymOut:
    """Добавить одно изображение в галерею зала (максимум 6 URL)."""
    row = await session.get(UserGym, gym_id)
    if not row or row.user_id != auth_user.id:
        raise HTTPException(status_code=404, detail="Зал не найден")
    if row.is_archived:
        raise HTTPException(status_code=400, detail="Зал в архиве")

    ext = Path(file.filename or "image.bin").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".jpg"

    if not _upload_is_image(file, ext):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")

    gym_dir = Path(settings.MEDIA_ROOT) / "user_gyms" / str(auth_user.id) / str(row.id)
    gym_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4().hex}{ext}"
    target = gym_dir / file_name

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Пустой файл")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 10MB)")

    target.write_bytes(content)
    rel_url = f"{settings.MEDIA_URL_PREFIX.rstrip('/')}/user_gyms/{auth_user.id}/{row.id}/{file_name}"
    urls = _normalize_gallery(row.gallery_urls)
    if len(urls) >= 6:
        raise HTTPException(status_code=400, detail="В галерее не больше 6 фото")

    urls.append(rel_url)
    row.gallery_urls = urls

    await session.commit()
    await session.refresh(row)
    await invalidate_user_gyms_cache(auth_user.id)

    vc, lwd = await _visit_stats(session, auth_user.id, gym_id)
    return _row_to_out(row, visit_count=vc, last_workout_date=lwd)
