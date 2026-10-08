#!/usr/bin/env python3
"""Плановые push-уведомления (cron: каждые 5–15 мин)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from db_config import SessionLocal  # noqa: E402
from services.postgres.workout_notification_jobs import (  # noqa: E402
    run_all_workout_notification_jobs,
)


async def main() -> None:
    async with SessionLocal() as session:
        stats = await run_all_workout_notification_jobs(session)
        await session.commit()
    print("notification jobs:", stats)


if __name__ == "__main__":
    asyncio.run(main())
