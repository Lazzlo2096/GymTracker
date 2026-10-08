"""Сценарии тренировок для PostgreSQL (вызывается из routers.workout)."""

from datetime import date

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import ExerciseInWorkout
from db.models.postgres.user import User as PgUser
from db.models.postgres.user_role import UserRole
from db.models.postgres.user_gym import UserGym as PgUserGym
from db.models.postgres.workout import Workout as PgWorkout
from db.repositories.postgres.workout_repository import (
    count_workouts_by_month,
    count_workouts_filtered,
    get_exercise_in_catalog,
    get_workout,
    list_client_ids_for_trainer,
    list_workouts_page,
    next_workout_exercise_order,
)
from schemas.workout import (
    AddExerciseToWorkoutResponse,
    WorkoutPatch,
    WorkoutReplace,
    WorkoutOut,
    WorkoutOutPaginatedList,
)
from utils.cache import invalidate_workouts_cache_scoped
from utils.db_errors import rollback_and_raise_integrity
from utils.workout_as_template import planned_sets_json_to_db, workout_to_template


async def _assert_user_gym_owner(
    session: AsyncSession,
    *,
    user_id: int,
    user_gym_id: int,
) -> PgUserGym:
    ug = await session.get(PgUserGym, user_gym_id)
    if not ug or ug.user_id != user_id:
        raise HTTPException(
            status_code=400,
            detail="Фитнес-зал не найден или не принадлежит пользователю",
        )
    if ug.is_archived:
        raise HTTPException(status_code=400, detail="Зал архивирован")
    return ug


def _user_gym_brief_dict(row: PgWorkout) -> dict | None:
    if not row.user_gym_id:
        return None

    ug = row.user_gym
    if ug is not None:
        return {"id": ug.id, "name": ug.name}
    return None


async def postgres_create_workout(
    session: AsyncSession,
    *,
    user_id: int,
    workout_date: date,
    day_title: str | None,
    note: str | None,
    user_gym_id: int | None = None,
) -> dict:
    u = await session.get(PgUser, user_id)
    if not u:
        raise HTTPException(status_code=400, detail="User not found")

    ug_fk: int | None = None
    if user_gym_id is not None:
        ug = await _assert_user_gym_owner(
            session, user_id=user_id, user_gym_id=user_gym_id
        )
        ug_fk = ug.id

    row = PgWorkout(
        user_id=user_id,
        workout_date=workout_date,
        day_title=day_title,
        note=note,
        user_gym_id=ug_fk,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Workout data conflict",
            other_detail="Could not create workout",
        )

    await session.refresh(row)
    if row.user_gym_id:
        await session.refresh(row, ["user_gym"])

    await invalidate_workouts_cache_scoped(session, user_id)

    return {
        "message": "Workout created",
        "id": row.id,
        "user_id": row.user_id,
        "workout_date": row.workout_date,
        "day_title": row.day_title,
        "note": row.note,
        "user_gym_id": row.user_gym_id,
        "user_gym": _user_gym_brief_dict(row),
        "created_at": row.created_at,
        "exercises": [],
    }


def _workout_row_to_dict(row: PgWorkout) -> dict:
    exercises = [
        {
            "id": ex.id,
            "exercise_in_catalog_id": ex.exercise_in_catalog_id,
            "workout_id": ex.workout_id,
            "order_index": ex.order_index,
            "start_time": ex.start_time,
            "end_time": ex.end_time,
            "sets_json": list(ex.sets_json or []),
            "planned_sets_json": list(ex.planned_sets_json or []),
            "planned_sets_count": ex.planned_sets,
            "note": ex.note,
        }
        for ex in (row.exercises or [])
    ]
    return {
        "id": row.id,
        "user_id": row.user_id,
        "workout_date": row.workout_date,
        "day_title": row.day_title,
        "note": row.note,
        "user_gym_id": row.user_gym_id,
        "user_gym": _user_gym_brief_dict(row),
        "created_at": row.created_at,
        "exercises": exercises,
    }


async def _get_authorized_workout(
    session: AsyncSession,
    workout_id: int,
    auth_user: PgUser,
) -> PgWorkout:
    row = await get_workout(session, workout_id)
    if not row:
        raise HTTPException(status_code=404, detail="Workout not found")
    if not await can_access_workout_owner(session, auth_user, row.user_id):
        raise HTTPException(status_code=404, detail="Workout not found")
    return row


async def postgres_get_workout(
    session: AsyncSession,
    workout_id: int,
    auth_user: PgUser,
) -> dict:
    row = await _get_authorized_workout(session, workout_id, auth_user)
    return _workout_row_to_dict(row)


async def postgres_replace_workout(
    session: AsyncSession,
    workout_id: int,
    data: WorkoutReplace,
    auth_user: PgUser,
) -> dict:
    row = await _get_authorized_workout(session, workout_id, auth_user)
    payload = data.model_dump()
    row.workout_date = payload["workout_date"]
    row.day_title = payload["day_title"]
    row.note = payload["note"]
    ug_id = payload.get("user_gym_id")
    if ug_id is not None:
        ug = await _assert_user_gym_owner(
            session, user_id=row.user_id, user_gym_id=ug_id
        )
        row.user_gym_id = ug.id
    else:
        row.user_gym_id = None
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Workout data conflict",
            other_detail="Could not update workout",
        )
    await invalidate_workouts_cache_scoped(
        session, row.user_id, also_invalidate=(auth_user.id,)
    )
    return {"status": "updated"}


async def postgres_patch_workout(
    session: AsyncSession,
    workout_id: int,
    data: WorkoutPatch,
    auth_user: PgUser,
) -> dict:
    row = await _get_authorized_workout(session, workout_id, auth_user)
    patch = data.model_dump(exclude_unset=True)
    allowed_fields = {"workout_date", "day_title", "note", "user_gym_id"}
    patch = {k: v for k, v in patch.items() if k in allowed_fields}
    if not patch:
        await invalidate_workouts_cache_scoped(
            session, row.user_id, also_invalidate=(auth_user.id,)
        )
        return {"status": "updated"}

    if "user_gym_id" in patch:
        v = patch["user_gym_id"]
        if v is None:
            row.user_gym_id = None
        else:
            ug = await _assert_user_gym_owner(
                session, user_id=row.user_id, user_gym_id=int(v)
            )
            row.user_gym_id = ug.id

    for k, v in patch.items():
        if k == "user_gym_id":
            continue
        setattr(row, k, v)
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Workout data conflict",
            other_detail="Could not update workout",
        )
    await invalidate_workouts_cache_scoped(
        session, row.user_id, also_invalidate=(auth_user.id,)
    )
    return {"status": "updated"}


async def postgres_delete_workout(
    session: AsyncSession,
    workout_id: int,
    auth_user: PgUser,
) -> dict:
    row = await _get_authorized_workout(session, workout_id, auth_user)
    await session.delete(row)
    await session.commit()
    await invalidate_workouts_cache_scoped(
        session, row.user_id, also_invalidate=(auth_user.id,)
    )
    return {"status": "deleted"}


def _normalize_role(role: UserRole | str) -> UserRole:
    if isinstance(role, UserRole):
        return role
    try:
        return UserRole(role)
    except ValueError:
        return UserRole.user


async def can_access_workout_owner(
    session: AsyncSession,
    auth_user: PgUser,
    workout_owner_id: int,
) -> bool:
    """Можно ли читать/менять тренировку владельца workout_owner_id."""
    role = _normalize_role(auth_user.role)
    if role == UserRole.admin:
        return True
    if role == UserRole.user:
        return workout_owner_id == auth_user.id
    trainees = await list_client_ids_for_trainer(session, auth_user.id)
    return workout_owner_id in {auth_user.id, *trainees}


async def _resolve_list_scope_user_ids(
    session: AsyncSession,
    auth_user: PgUser,
    user_query: str | None,
) -> list[int] | None:
    """
    Как фильтровать по владельцу тренировки (user_id).
    None — без ограничения по пользователю (только admin, все тренировки).
    Список — WHERE user_id IN (...).
    """
    role = _normalize_role(auth_user.role)

    parsed: int | None = None
    if user_query is not None and str(user_query).strip() != "":
        try:
            parsed = int(str(user_query).strip())
        except ValueError as e:
            raise HTTPException(
                status_code=422,
                detail="Параметр user должен быть целым id пользователя",
            ) from e

    if role == UserRole.admin:
        if parsed is not None:
            return [parsed]
        return None

    if role == UserRole.user:
        if parsed is not None and parsed != auth_user.id:
            raise HTTPException(
                status_code=403,
                detail="Нет доступа к тренировкам другого пользователя",
            )
        return [auth_user.id]

    # trainer: свои + подопечные из trainer_clients
    trainees = await list_client_ids_for_trainer(session, auth_user.id)
    allowed = {auth_user.id, *trainees}
    if parsed is not None:
        if parsed not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Нет доступа к тренировкам этого пользователя",
            )
        return [parsed]
    return sorted(allowed)


async def postgres_list_workouts(
    session: AsyncSession,
    auth_user: PgUser,
    user: str | None,
    *,
    limit: int = 20,
    offset: int = 0,
    sort: str = "workout_date",
    order: str = "desc",
    date_from: date | None = None,
    date_to: date | None = None,
    gym_name: str | None = None,
    q: str | None = None,
    day_title_contains: str | None = None,
) -> WorkoutOutPaginatedList:
    """
    Пагинированный список тренировок с фильтрами и сортировкой.
    Доступ по роли из БД (и дублируется в JWT как `role`):
    user — только свои; trainer — свои и подопечных; admin — все (или один user по query).
    """
    user_ids = await _resolve_list_scope_user_ids(session, auth_user, user)

    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail="date_from не может быть позже date_to",
        )

    sort_by = (
        sort if sort in ("workout_date", "tonnage", "created_at") else "workout_date"
    )
    sort_desc = order.lower() != "asc"

    filter_kw = dict(
        date_from=date_from,
        date_to=date_to,
        gym_name=gym_name,
        q=q,
        day_title_contains=day_title_contains,
    )
    total = await count_workouts_filtered(session, user_ids, **filter_kw)
    counts_by_month = await count_workouts_by_month(session, user_ids, **filter_kw)
    rows = await list_workouts_page(
        session,
        user_ids,
        **filter_kw,
        sort_by=sort_by,
        sort_desc=sort_desc,
        limit=limit,
        offset=offset,
    )
    items = [WorkoutOut.model_validate(_workout_row_to_dict(r.workout)) for r in rows]
    return WorkoutOutPaginatedList(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
        counts_by_month=counts_by_month,
    )


async def postgres_add_exercise_to_workout(
    session: AsyncSession,
    workout_id: int,
    exercise_id: int,
    auth_user: PgUser,
) -> AddExerciseToWorkoutResponse:
    """
    Добавить упражнение из каталога в тренировку (новая строка `exercise_in_workout`).

    `exercise_id` — id записи в `exercises_in_catalog`; возвращаемый `exercise_id` в теле ответа —
    id созданной строки `exercise_in_workout` (экземпляр упражнения в этой тренировке).
    """
    workout = await get_workout(session, workout_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    if not await can_access_workout_owner(session, auth_user, workout.user_id):
        raise HTTPException(status_code=404, detail="Workout not found")

    cat = await get_exercise_in_catalog(session, exercise_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Exercise not found in catalog")
    if cat.user_id != workout.user_id:
        raise HTTPException(
            status_code=400,
            detail="Упражнение из каталога принадлежит другому пользователю, чем тренировка",
        )

    next_order = await next_workout_exercise_order(session, workout_id)

    we = ExerciseInWorkout(
        workout_id=workout_id,
        exercise_in_catalog_id=exercise_id,
        order_index=next_order,
        sets_json=[],
    )
    session.add(we)
    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="В тренировке уже есть упражнение с таким порядковым номером",
            other_detail="Не удалось добавить упражнение в тренировку",
        )
    await session.refresh(we)
    await invalidate_workouts_cache_scoped(
        session, workout.user_id, also_invalidate=(auth_user.id,)
    )

    return AddExerciseToWorkoutResponse(
        message="Exercise added to workout",
        workout_id=workout.id,
        exercise_id=we.id,
    )


async def postgres_repeat_workout(
    session: AsyncSession,
    workout_id: int,
    auth_user: PgUser,
    *,
    workout_date: date | None = None,
    day_title: str | None = None,
) -> dict:
    """
    Повторяет выполненную тренировку: пустой sets_json,
    planned_sets_json из фактических set/rest записей исходной тренировки.
    """
    source = await _get_authorized_workout(session, workout_id, auth_user)
    template = workout_to_template(
        _workout_row_to_dict(source),
        workout_date=workout_date,
        day_title=day_title,
        strip_ids=True,
        clear_created_at=True,
    )

    ug_fk: int | None = template.user_gym_id
    if ug_fk is not None:
        await _assert_user_gym_owner(session, user_id=source.user_id, user_gym_id=ug_fk)

    row = PgWorkout(
        user_id=source.user_id,
        workout_date=template.workout_date,
        day_title=template.day_title,
        note=template.note,
        user_gym_id=ug_fk,
    )
    session.add(row)
    await session.flush()

    for ex_tmpl in template.exercises:
        catalog_id = ex_tmpl.exercise_in_catalog_id
        if catalog_id is not None:
            cat = await get_exercise_in_catalog(session, catalog_id)
            if not cat or cat.user_id != source.user_id:
                await session.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Упражнение каталога {catalog_id} не найдено "
                        "или принадлежит другому пользователю"
                    ),
                )

        planned_json = planned_sets_json_to_db(ex_tmpl.planned_sets_json)
        we = ExerciseInWorkout(
            workout_id=row.id,
            exercise_in_catalog_id=catalog_id,
            order_index=ex_tmpl.order_index,
            sets_json=[],
            planned_sets_json=planned_json,
            planned_sets=ex_tmpl.planned_sets_count if not planned_json else None,
            note=ex_tmpl.note,
        )
        session.add(we)

    try:
        await session.commit()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Conflicting exercise order in workout",
            other_detail="Could not repeat workout",
        )

    await session.refresh(row, ["exercises", "user_gym"])
    await invalidate_workouts_cache_scoped(
        session, source.user_id, also_invalidate=(auth_user.id,)
    )

    return {
        "message": "Workout repeated",
        **_workout_row_to_dict(row),
    }
