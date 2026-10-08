"""
Фикстуры API- и сервисных тестов: PostgreSQL со схемой из Alembic, Redis, ASGI-клиент.

Живой сервер не нужен. Запуск из корня репозитория:
  docker compose -f docker-compose.test.yml run --rm tests
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import AsyncIterator

os.environ.setdefault("MEDIA_ROOT", tempfile.mkdtemp(prefix="gymtracker-media-"))

import httpx
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from project_config import settings

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="session")
def migrated_db() -> None:
    database = make_url(settings.DATABASE_URL).database or ""
    if not database.endswith("_test"):
        raise RuntimeError(
            "Тесты очищают все таблицы: DATABASE_URL должен указывать на базу *_test "
            f"(сейчас {database!r})"
        )
    config = Config()
    config.set_main_option("script_location", os.path.join(_BACKEND_DIR, "alembic"))
    command.upgrade(config, "head")


@pytest_asyncio.fixture(scope="session")
async def app(migrated_db):
    from db_config import engine
    from main import app as fastapi_app

    async with fastapi_app.router.lifespan_context(fastapi_app):
        yield fastapi_app
    await engine.dispose()


@pytest_asyncio.fixture
async def clean_state(app) -> None:
    from db.models.postgres import Base
    from db_config import engine
    from services.redis import get_redis

    tables = ", ".join(f'"{name}"' for name in Base.metadata.tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    await get_redis().flushdb()


@pytest.fixture
def outbox(monkeypatch) -> list[dict[str, str]]:
    """Письма, которые приложение отправило бы по SMTP."""
    sent: list[dict[str, str]] = []

    async def _fake_send(*, to: str, subject: str, html: str) -> None:
        sent.append({"to": to, "subject": subject, "html": html})

    monkeypatch.setattr(
        "services.postgres.email_verification_actions.send_email_async", _fake_send
    )
    return sent


@pytest_asyncio.fixture
async def client(app, clean_state, outbox) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def db_session(app, clean_state) -> AsyncIterator[AsyncSession]:
    from db_config import SessionLocal

    async with SessionLocal() as session:
        yield session
