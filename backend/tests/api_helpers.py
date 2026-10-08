"""Помощники API-тестов: регистрация пользователей и подсчёт SQL-запросов."""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

import httpx
from sqlalchemy import event

API = "/api/v1"
DEFAULT_PASSWORD = "Secret123!"


@dataclass(frozen=True)
class RegisteredUser:
    id: int
    email: str
    username: str
    password: str
    access_token: str
    refresh_token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}


async def register_user(
    client: httpx.AsyncClient,
    *,
    email: str | None = None,
    username: str | None = None,
    password: str = DEFAULT_PASSWORD,
    promo_code: str | None = None,
) -> RegisteredUser:
    suffix = uuid.uuid4().hex[:10]
    email = email or f"user_{suffix}@example.com"
    username = username or f"user_{suffix}"
    body = {"email": email, "username": username, "password": password}
    if promo_code is not None:
        body["promo_code"] = promo_code

    r = await client.post(f"{API}/auth/register", json=body)
    assert r.status_code == 200, r.text
    tokens = r.json()
    # Регистрация ставит cookie; без очистки следующий пользователь в том же клиенте
    # авторизовался бы cookie предыдущего, а не своим Bearer-заголовком.
    client.cookies.clear()

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = await client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    return RegisteredUser(
        id=me.json()["id"],
        email=email,
        username=username,
        password=password,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
    )


@contextmanager
def count_queries() -> Iterator[list[str]]:
    """SQL-выражения, ушедшие в PostgreSQL внутри блока."""
    from db_config import engine

    statements: list[str] = []

    def _before_execute(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _before_execute)
    try:
        yield statements
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _before_execute)
