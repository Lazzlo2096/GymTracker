"""
Живой прогон GET/POST тренировок против запущенного API (http://127.0.0.1:8000).

В обычный pytest не входит: без GYMTRACKER_HTTP_TESTS=1 модуль пропускается.

Запуск (из каталога backend, API уже слушает :8000):
  set GYMTRACKER_HTTP_TESTS=1
  python -m pytest -v tests/test_workouts_http_local.py

Другой хост: GYMTRACKER_HTTP_BASE=http://127.0.0.1:8000
"""

from __future__ import annotations

import os

import pytest

from project_config import http_test_settings

requests = pytest.importorskip("requests")

pytestmark = pytest.mark.skipif(
    os.environ.get("GYMTRACKER_HTTP_TESTS") != "1",
    reason="Живой HTTP-прогон: задайте GYMTRACKER_HTTP_TESTS=1 и запущенный API",
)

BASE = http_test_settings.HTTP_BASE.rstrip("/")
WORKOUTS_URL = f"{BASE}/api/v1/workouts/"
OPENAPI_PING = f"{BASE}/openapi.json"


def _skip_if_unreachable() -> None:
    try:
        requests.get(OPENAPI_PING, timeout=3)
    except requests.RequestException as exc:
        pytest.skip(f"Нет ответа от {OPENAPI_PING!r}: {exc}")


@pytest.fixture(autouse=True)
def require_server() -> None:
    _skip_if_unreachable()


def test_get_workouts_without_auth_is_401() -> None:
    r = requests.get(WORKOUTS_URL, timeout=10)
    assert r.status_code == 401, r.text


def test_post_empty_body_is_422() -> None:
    r = requests.post(WORKOUTS_URL, json={}, timeout=10)
    assert r.status_code == 422
    body = r.json()
    assert "detail" in body


def test_post_workout_minimal_body() -> None:
    """201 — успех; 400 — нет пользователя / ограничение БД. 500 — ошибка сервера (не ожидается)."""
    r = requests.post(
        WORKOUTS_URL,
        json={
            "user_id": 1,
            "workout_date": "2025-03-22",
        },
        timeout=10,
    )
    assert r.status_code in (201, 400), f"unexpected {r.status_code}: {r.text[:800]}"
    body = r.json()
    if r.status_code == 201:
        assert "id" in body
    else:
        assert "detail" in body
