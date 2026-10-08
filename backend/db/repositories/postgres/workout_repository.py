"""Чтение данных по тренировкам из PostgreSQL."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import and_, asc, desc, false, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.expression import literal_column

from db.models.postgres import (
    Workout,
    ExerciseInWorkout,
    ExerciseInCatalog,
    TrainerClient,
)
from db.models.postgres.user_gym import UserGym

_ILIKE_ESCAPE = "\\"


def _ilike_contains(value: str) -> tuple[str, str]:
    """Подстрока для ILIKE: экранируем % и _ чтобы ввод пользователя не работал как шаблон SQL."""
    s = value.strip()
    escaped = (
        s.replace(_ILIKE_ESCAPE, _ILIKE_ESCAPE * 2)
        .replace("%", _ILIKE_ESCAPE + "%")
        .replace("_", _ILIKE_ESCAPE + "_")
    )
    return f"%{escaped}%", _ILIKE_ESCAPE


# Тоннаж по JSON-подходам: weight или weight_kg × reps (как на клиентах).
# Отрицательный вес допускается (например, гравитрон).
_TONNAGE_SQL = """
COALESCE((
  SELECT SUM(
    CASE
      WHEN (elem->>'reps') ~ '^[0-9]+$' THEN
        COALESCE(
          NULLIF(trim(elem->>'weight'), '')::double precision,
          NULLIF(trim(elem->>'weight_kg'), '')::double precision,
          0
        ) * (elem->>'reps')::double precision
      ELSE 0::double precision
    END
  )
  FROM exercise_in_workout we2
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(we2.sets_json, '[]'::jsonb)) AS elem
  WHERE we2.workout_id = workouts.id
), 0::double precision)
"""


@dataclass
class WorkoutListRow:
    """Строка списка тренировок с агрегированным тоннажом."""

    workout: Workout
    tonnage_kg: float


async def list_workouts(
    session: AsyncSession,
    user_ids: Sequence[int] | None = None,
) -> list[Workout]:
    stmt = (
        select(Workout)
        .options(selectinload(Workout.exercises))
        .order_by(desc(Workout.workout_date))
    )
    where = _workout_filter_conditions(
        user_ids,
        date_from=None,
        date_to=None,
        gym_name=None,
        q=None,
        day_title_contains=None,
    )
    if where is not None:
        stmt = stmt.where(where)

    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


def _workout_filter_conditions(
    user_ids: Sequence[int] | None,
    *,
    date_from: date | None,
    date_to: date | None,
    gym_name: str | None,
    q: str | None,
    day_title_contains: str | None,
):
    conds = []
    if user_ids is not None:
        ids = list(user_ids)
        if len(ids) == 0:
            conds.append(false())
        elif len(ids) == 1:
            conds.append(Workout.user_id == ids[0])
        else:
            conds.append(Workout.user_id.in_(ids))
    if date_from is not None:
        conds.append(Workout.workout_date >= date_from)
    if date_to is not None:
        conds.append(Workout.workout_date <= date_to)
    if gym_name and gym_name.strip():
        pat, esc = _ilike_contains(gym_name)
        conds.append(Workout.user_gym.has(UserGym.name.ilike(pat, escape=esc)))
    if day_title_contains and day_title_contains.strip():
        pat, esc = _ilike_contains(day_title_contains)
        conds.append(Workout.day_title.ilike(pat, escape=esc))
    if q and q.strip():
        pat, esc = _ilike_contains(q)
        conds.append(
            or_(
                Workout.day_title.ilike(pat, escape=esc),
                Workout.note.ilike(pat, escape=esc),
                Workout.user_gym.has(UserGym.name.ilike(pat, escape=esc)),
            )
        )
    return and_(*conds) if conds else None


async def count_workouts_filtered(
    session: AsyncSession,
    user_ids: Sequence[int] | None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    gym_name: str | None = None,
    q: str | None = None,
    day_title_contains: str | None = None,
) -> int:
    where = _workout_filter_conditions(
        user_ids,
        date_from=date_from,
        date_to=date_to,
        gym_name=gym_name,
        q=q,
        day_title_contains=day_title_contains,
    )
    stmt = select(func.count()).select_from(Workout)
    if where is not None:
        stmt = stmt.where(where)
    result = await session.execute(stmt)
    return int(result.scalar_one() or 0)


async def count_workouts_by_month(
    session: AsyncSession,
    user_ids: Sequence[int] | None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    gym_name: str | None = None,
    q: str | None = None,
    day_title_contains: str | None = None,
) -> dict[str, int]:
    """
    Число тренировок по календарным месяцам (с учётом фильтров, без пагинации).
    Ключ «YYYY-M», M — 0..11 как Date.getMonth() в JavaScript.
    """
    where = _workout_filter_conditions(
        user_ids,
        date_from=date_from,
        date_to=date_to,
        gym_name=gym_name,
        q=q,
        day_title_contains=day_title_contains,
    )
    year_col = func.extract("year", Workout.workout_date)
    month_col = func.extract("month", Workout.workout_date)
    stmt = (
        select(year_col, month_col, func.count())
        .select_from(Workout)
        .group_by(year_col, month_col)
        .order_by(desc(year_col), desc(month_col))
    )
    if where is not None:
        stmt = stmt.where(where)
    result = await session.execute(stmt)
    out: dict[str, int] = {}
    for year_raw, month_raw, cnt in result.all():
        if year_raw is None or month_raw is None:
            continue
        year = int(year_raw)
        month_js = int(month_raw) - 1
        if month_js < 0 or month_js > 11:
            continue
        out[f"{year}-{month_js}"] = int(cnt or 0)
    return out


async def list_workouts_page(
    session: AsyncSession,
    user_ids: Sequence[int] | None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    gym_name: str | None = None,
    q: str | None = None,
    day_title_contains: str | None = None,
    sort_by: str = "workout_date",
    sort_desc: bool = True,
    limit: int = 20,
    offset: int = 0,
) -> list[WorkoutListRow]:
    """
    Постраничный список без подгрузки exercises (тоннаж считается в SQL).
    sort_by: workout_date | tonnage | created_at
    """
    where = _workout_filter_conditions(
        user_ids,
        date_from=date_from,
        date_to=date_to,
        gym_name=gym_name,
        q=q,
        day_title_contains=day_title_contains,
    )

    tonnage_col = literal_column(_TONNAGE_SQL).label("tonnage_kg")

    stmt = select(Workout, tonnage_col).options(
        selectinload(Workout.exercises),
        selectinload(Workout.user_gym),
    )
    if where is not None:
        stmt = stmt.where(where)

    if sort_by == "tonnage":
        primary = desc(tonnage_col) if sort_desc else asc(tonnage_col)
    elif sort_by == "created_at":
        primary = desc(Workout.created_at) if sort_desc else asc(Workout.created_at)
    else:
        primary = desc(Workout.workout_date) if sort_desc else asc(Workout.workout_date)

    stmt = stmt.order_by(primary, desc(Workout.id))
    stmt = stmt.limit(limit).offset(offset)

    result = await session.execute(stmt)
    out: list[WorkoutListRow] = []
    for w, tkg in result.all():
        out.append(WorkoutListRow(workout=w, tonnage_kg=float(tkg or 0)))
    return out


async def get_workout(session: AsyncSession, workout_id: int) -> Workout | None:
    result = await session.execute(
        select(Workout)
        .options(
            selectinload(Workout.exercises),
            selectinload(Workout.user_gym),
        )
        .where(Workout.id == workout_id)
    )
    return result.scalars().first()


async def get_exercise_in_catalog(
    session: AsyncSession, exercise_id: int
) -> ExerciseInCatalog | None:
    return await session.get(ExerciseInCatalog, exercise_id)


async def list_client_ids_for_trainer(
    session: AsyncSession, trainer_id: int
) -> list[int]:
    """ID подопечных тренера (таблица trainer_clients)."""
    result = await session.execute(
        select(TrainerClient.client_id).where(TrainerClient.trainer_id == trainer_id)
    )
    return [row[0] for row in result.all()]


async def list_trainer_ids_for_client(
    session: AsyncSession, client_id: int
) -> list[int]:
    """ID тренеров подопечного (таблица trainer_clients)."""
    result = await session.execute(
        select(TrainerClient.trainer_id).where(TrainerClient.client_id == client_id)
    )
    return [row[0] for row in result.all()]


async def lock_workout_row(session: AsyncSession, workout_id: int) -> None:
    """Блокирует строку тренировки до commit/rollback текущей транзакции.

    Параллельные вставки упражнений в одну тренировку ждут эту блокировку,
    иначе два запроса читают один MAX(order_index) и пишут одинаковый номер.
    """
    await session.execute(
        select(Workout.id).where(Workout.id == workout_id).with_for_update()
    )


async def next_workout_exercise_order(session: AsyncSession, workout_id: int) -> int:
    await lock_workout_row(session, workout_id)
    result = await session.execute(
        select(func.coalesce(func.max(ExerciseInWorkout.order_index), -1)).where(
            ExerciseInWorkout.workout_id == workout_id
        )
    )
    return int(result.scalar_one()) + 1
