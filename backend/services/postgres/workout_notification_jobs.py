"""Плановые уведомления: стрики и привычное время тренировки."""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.postgres import User, Workout
from services.postgres.push_actions import (
    NOTIF_WORKOUT_HABIT,
    NOTIF_WORKOUT_STREAK,
    send_push_to_user,
)

_WEEKDAY_NAMES_RU = {
    0: "понедельник",
    1: "вторник",
    2: "среда",
    3: "четверг",
    4: "пятница",
    5: "суббота",
    6: "воскресенье",
}

_HABIT_MESSAGES = [
    "Обычно в {weekday} вы тренируетесь около {hour}:00 — сегодня ещё не было тренировки. Время показать, на что способны!",
    "Сегодня {weekday} — ваш типичный день зала. Запишем тренировку?",
    "Похоже, сегодня ваш день: обычно в это время вы уже в зале. Не срывайте серию!",
]

_STREAK_MESSAGES = [
    "Стрик {days} дн. подряд! Не пропустите сегодня — закрепите привычку.",
    "У вас {days} дней тренировок подряд. Сегодняшний день тоже ваш!",
]


def _parse_weekdays(raw: str) -> set[int]:
    out: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            d = int(part)
            if 1 <= d <= 7:
                out.add(d)
        except ValueError:
            continue
    return out or {1, 2, 3, 4, 5, 6, 7}


def _user_now(user: User) -> datetime:
    tz_name = "UTC"
    if user.reminds and user.reminds.workout_reminder_timezone:
        tz_name = user.reminds.workout_reminder_timezone
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz)


async def _has_workout_on(session: AsyncSession, user_id: int, day: date) -> bool:
    r = await session.scalar(
        select(func.count())
        .select_from(Workout)
        .where(Workout.user_id == user_id, Workout.workout_date == day)
    )
    return int(r or 0) > 0


async def _workout_streak_days(session: AsyncSession, user_id: int, today: date) -> int:
    streak = 0
    d = today - timedelta(days=1)
    while True:
        if await _has_workout_on(session, user_id, d):
            streak += 1
            d -= timedelta(days=1)
        else:
            break
    return streak


async def _typical_hour_for_weekday(
    session: AsyncSession, user_id: int, weekday: int
) -> int | None:
    """weekday: 0=Mon .. 6=Sun (Python)."""
    r = await session.execute(
        select(Workout.created_at)
        .where(
            Workout.user_id == user_id,
            func.extract("dow", Workout.created_at) == float((weekday + 1) % 7),
        )
        .order_by(Workout.created_at.desc())
        .limit(40)
    )
    hours: list[int] = []
    for (created_at,) in r.all():
        if created_at is None:
            continue
        hours.append(created_at.hour)
    if len(hours) < 3:
        return None
    return Counter(hours).most_common(1)[0][0]


async def _load_users_with_notification_settings(session: AsyncSession) -> list[User]:
    return list(
        await session.scalars(
            select(User).options(
                selectinload(User.client_settings),
                selectinload(User.reminds),
            )
        )
    )


async def process_streak_nudges(session: AsyncSession) -> int:
    sent = 0
    users = await _load_users_with_notification_settings(session)
    for user in users:
        now = _user_now(user)
        if now.hour < 17:
            continue

        today = now.date()
        if await _has_workout_on(session, user.id, today):
            continue

        streak = await _workout_streak_days(session, user.id, today)
        if streak < 2:
            continue

        dedup = f"{today.isoformat()}"
        msg = _STREAK_MESSAGES[streak % len(_STREAK_MESSAGES)].format(days=streak)
        ok = await send_push_to_user(
            session,
            user,
            title="Стрик тренировок",
            body=msg,
            kind=NOTIF_WORKOUT_STREAK,
            dedup_key=dedup,
            workout_related=True,
        )
        if ok:
            sent += 1
    return sent


async def process_habit_nudges(session: AsyncSession) -> int:
    sent = 0
    users = await _load_users_with_notification_settings(session)
    for user in users:
        client = user.client_settings
        reminds = user.reminds
        if client is None or not client.settings_notifications:
            continue
        if reminds is None or not reminds.settings_workout_reminders:
            continue

        now = _user_now(user)
        today = now.date()
        if await _has_workout_on(session, user.id, today):
            continue

        py_weekday = now.weekday()
        typical_hour = await _typical_hour_for_weekday(session, user.id, py_weekday)
        if typical_hour is None:
            continue

        if abs(now.hour - typical_hour) > 1:
            continue

        dedup = f"{today.isoformat()}"
        weekday_ru = _WEEKDAY_NAMES_RU.get(py_weekday, "сегодня")
        template = _HABIT_MESSAGES[now.day % len(_HABIT_MESSAGES)]
        body = template.format(weekday=weekday_ru, hour=typical_hour)
        ok = await send_push_to_user(
            session,
            user,
            title="Время тренировки?",
            body=body,
            kind=NOTIF_WORKOUT_HABIT,
            dedup_key=dedup,
            workout_related=True,
        )
        if ok:
            sent += 1
    return sent


async def run_all_workout_notification_jobs(session: AsyncSession) -> dict[str, int]:
    return {
        "streaks": await process_streak_nudges(session),
        "habits": await process_habit_nudges(session),
    }
