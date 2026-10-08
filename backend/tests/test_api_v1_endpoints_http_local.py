"""
Живой прогон API v1 против запущенного uvicorn (по умолчанию http://127.0.0.1:8000).

В обычный pytest не входит: без GYMTRACKER_HTTP_TESTS=1 модуль пропускается.
Любой 4xx/5xx роняет прогон. Негативные сценарии (422/401) здесь не проверяются.

Запуск (из каталога backend, API уже слушает :8000):
  python -m pip install requests pytest
  set GYMTRACKER_HTTP_TESTS=1
  python -m pytest -v tests/test_api_v1_endpoints_http_local.py

Другой хост: GYMTRACKER_HTTP_BASE=http://127.0.0.1:8000
"""

from __future__ import annotations

import os
import uuid

import pytest

from project_config import http_test_settings

requests = pytest.importorskip("requests")

pytestmark = pytest.mark.skipif(
    os.environ.get("GYMTRACKER_HTTP_TESTS") != "1",
    reason="Живой HTTP-прогон: задайте GYMTRACKER_HTTP_TESTS=1 и запущенный API",
)

TIMEOUT = 10
BASE = http_test_settings.HTTP_BASE.rstrip("/")
API = f"{BASE}/api/v1"
PING_URL = f"{API}/health"


def _skip_if_unreachable() -> None:
    try:
        requests.get(PING_URL, timeout=3)
    except requests.RequestException as exc:
        pytest.skip(f"Нет ответа от {PING_URL!r}: {exc}")


@pytest.fixture(autouse=True)
def require_server() -> None:
    _skip_if_unreachable()


def assert_2xx(resp: requests.Response, what: str = "HTTP") -> None:
    if not (200 <= resp.status_code < 300):
        snippet = (resp.text or "")[:800]
        pytest.fail(f"{what}: ожидался 2xx, получен {resp.status_code}: {snippet}")


def _csrf_access_headers(session: requests.Session) -> dict[str, str]:
    """AuthX при JWT_COOKIE_CSRF_PROTECT: для POST/PUT/PATCH/DELETE с cookies."""
    v = session.cookies.get("csrf_access_token")
    return {"X-CSRF-TOKEN": v} if v else {}


def _csrf_refresh_headers(session: requests.Session) -> dict[str, str]:
    v = session.cookies.get("csrf_refresh_token")
    return {"X-CSRF-TOKEN": v} if v else {}


def register_session() -> tuple[requests.Session, str, str, str]:
    """Новая сессия после успешной регистрации."""
    session = requests.Session()
    email = f"it_{uuid.uuid4().hex}@example.com"
    username = f"u_{uuid.uuid4().hex[:12]}"
    password = "Abcd1234!"
    reg = session.post(
        f"{API}/auth/register",
        json={"email": email, "username": username, "password": password},
        timeout=TIMEOUT,
    )
    assert_2xx(reg, "POST /auth/register")
    return session, email, username, password


# --- Служебные URL FastAPI ---


def test_health_check_2xx() -> None:
    r = requests.get(f"{API}/health", timeout=TIMEOUT)
    assert_2xx(r, "GET /health")
    data = r.json()
    assert data.get("status") in ("ok", "degraded", "unhealthy")
    assert "resources" in data
    res = data["resources"]
    for key in (
        "cpu_percent",
        "memory_percent",
        "disk_used_percent",
        "disk_free_percent",
    ):
        assert key in res
        assert isinstance(res[key], (int, float))


def test_openapi_json_when_exposed_at_base() -> None:
    r = requests.get(f"{BASE}/openapi.json", timeout=TIMEOUT)
    assert_2xx(r, "GET /openapi.json")
    try:
        data = r.json()
    except ValueError:
        pytest.fail(
            f"{BASE}/openapi.json вернул не JSON: {(r.text or '')[:200]!r}"
        )
    if not isinstance(data, dict) or "paths" not in data:
        pytest.fail("Ответ не похож на OpenAPI (нет ключа paths)")
    paths = data["paths"]
    assert any("api" in p and "v1" in p and "workouts" in p for p in paths)
    assert any("trainer_clients" in p for p in paths)


def test_swagger_docs_when_exposed_at_base() -> None:
    r = requests.get(f"{BASE}/docs", timeout=TIMEOUT)
    assert_2xx(r, "GET /docs")
    text = r.text.lower()
    if "swagger" not in text and "openapi" not in text:
        pytest.fail(f"/docs с {BASE!r} — не Swagger UI")


# --- /api/v1/auth ---


def test_auth_register_me_refresh_logout_login_me_2xx() -> None:
    session, email, username, password = register_session()

    me = session.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert_2xx(me, "GET /auth/me")
    me_data = me.json()
    assert "id" in me_data
    assert me_data.get("role") == "user"

    ref = session.post(
        f"{API}/auth/refresh",
        json={},
        headers=_csrf_refresh_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(ref, "POST /auth/refresh")

    lo = session.post(
        f"{API}/auth/logout",
        json={},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(lo, "POST /auth/logout")

    lg = session.post(
        f"{API}/auth/login",
        json={"login": email, "password": password},
        timeout=TIMEOUT,
    )
    assert_2xx(lg, "POST /auth/login")

    me2 = session.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert_2xx(me2, "GET /auth/me после login")


# --- /api/v1/workouts ---


def test_workouts_list_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/workouts/", timeout=TIMEOUT)
    assert_2xx(r, "GET /workouts/")
    body = r.json()
    assert isinstance(body, dict) and "items" in body, body


def test_workouts_crud_and_add_exercise_and_eiw_actions_2xx() -> None:
    """
    Создание тренировки для пользователя из PostgreSQL (/auth/me), каталог,
    add_exercise, затем действия exercises_in_workout — всё только при 2xx.
    """
    session, email, username, password = register_session()

    me = session.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert_2xx(me, "GET /auth/me")
    user_id = me.json()["id"]

    w = session.post(
        f"{API}/workouts/",
        json={
            "user_id": user_id,
            "workout_date": "2025-03-22",
            "location": "integration-test-2xx",
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(w, "POST /workouts/")
    wid = str(w.json()["id"])

    r = session.get(f"{API}/workouts/{wid}", timeout=TIMEOUT)
    assert_2xx(r, "GET /workouts/{id}")

    r = session.put(
        f"{API}/workouts/{wid}",
        json={"note": "patched-by-test"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PUT /workouts/{id}")

    cat_name = f"it_cat_{uuid.uuid4().hex[:12]}"
    c = session.post(
        f"{API}/exercises_in_catalog/",
        json={"name": cat_name, "notes": "e2e"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(c, "POST /exercises_in_catalog/")
    cid = str(c.json()["id"])

    r = session.get(f"{API}/exercises_in_catalog/{cid}", timeout=TIMEOUT)
    assert_2xx(r, "GET /exercises_in_catalog/{id}")

    r = session.put(
        f"{API}/exercises_in_catalog/{cid}",
        json={"name": cat_name, "notes": "updated"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PUT /exercises_in_catalog/{id}")

    add_ex = session.post(
        f"{API}/workouts/{wid}/add_exercise/{cid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(add_ex, "POST /workouts/.../add_exercise/...")
    eiw_id = str(add_ex.json()["exercise_id"])

    r = session.post(
        f"{API}/exercises_in_workout/{eiw_id}/set",
        json={"reps": 5},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "POST .../set")

    r = session.put(
        f"{API}/exercises_in_workout/{eiw_id}/set/0",
        json={"reps": 6},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PUT .../set/0")

    r = session.patch(
        f"{API}/exercises_in_workout/{eiw_id}/planned_sets",
        json={"planned_sets": 4},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PATCH .../planned_sets")

    r = session.put(
        f"{API}/exercises_in_workout/{eiw_id}/set",
        json=[{"reps": 1}],
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PUT .../set (bulk)")

    r = session.delete(
        f"{API}/exercises_in_workout/{eiw_id}/set/0",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE .../set/0")

    r = session.get(f"{API}/exercises_in_workout/{eiw_id}", timeout=TIMEOUT)
    assert_2xx(r, "GET /exercises_in_workout/{id}")

    r = session.delete(
        f"{API}/exercises_in_workout/{eiw_id}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /exercises_in_workout/{id}")

    r = session.delete(
        f"{API}/workouts/{wid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /workouts/{id}")

    r = session.delete(
        f"{API}/exercises_in_catalog/{cid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /exercises_in_catalog/{id}")


# --- /api/v1/exercises_in_workout (список; детальные действия — в цепочке выше) ---


def test_exercises_in_workout_list_2xx() -> None:
    r = requests.get(f"{API}/exercises_in_workout/", timeout=TIMEOUT)
    assert_2xx(r, "GET /exercises_in_workout/")
    assert isinstance(r.json(), list)


def test_exercises_in_workout_post_put_get_delete_root_crud_2xx() -> None:
    """
    POST /exercises_in_workout/ (auto-CRUD) с workout_id + exercise_id для PostgreSQL,
    затем PUT, GET, DELETE того же ресурса.
    """
    session, email, username, password = register_session()

    me = session.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert_2xx(me, "GET /auth/me")
    user_id = me.json()["id"]

    w = session.post(
        f"{API}/workouts/",
        json={
            "user_id": user_id,
            "workout_date": "2024-06-15",
            "location": "eiw-root-crud",
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(w, "POST /workouts/")
    wid = int(w.json()["id"])

    cat_name = f"it_eiw_root_{uuid.uuid4().hex[:12]}"
    c = session.post(
        f"{API}/exercises_in_catalog/",
        json={"name": cat_name, "notes": "eiw-root"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(c, "POST /exercises_in_catalog/")
    cid = int(c.json()["id"])

    body = {
        "workout_id": wid,
        "exercise_id": cid,
        "sets": [{"reps": 8, "weight_kg": 20.0}],
        "planned_sets": 3,
    }
    r = session.post(
        f"{API}/exercises_in_workout/",
        json=body,
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "POST /exercises_in_workout/")
    eiw_id = str(r.json().get("id") or "")
    assert eiw_id, r.text

    r = session.put(
        f"{API}/exercises_in_workout/{eiw_id}",
        json={"note": "patched-eiw-root", "planned_sets": 4},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PUT /exercises_in_workout/{id}")

    r = session.get(f"{API}/exercises_in_workout/{eiw_id}", timeout=TIMEOUT)
    assert_2xx(r, "GET /exercises_in_workout/{id}")
    data = r.json()
    assert data.get("planned_sets_count") == 4
    assert data.get("note") == "patched-eiw-root"

    r = session.delete(
        f"{API}/exercises_in_workout/{eiw_id}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /exercises_in_workout/{id}")

    r = session.delete(
        f"{API}/workouts/{wid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /workouts/{id}")

    r = session.delete(
        f"{API}/exercises_in_catalog/{cid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /exercises_in_catalog/{id}")


# --- /api/v1/user_weights ---


def test_user_weights_list_2xx() -> None:
    r = requests.get(f"{API}/user_weights/", timeout=TIMEOUT)
    assert_2xx(r, "GET /user_weights/")
    assert isinstance(r.json(), list)


def test_user_weights_crud_roundtrip_2xx() -> None:
    session, email, username, password = register_session()
    me = session.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert_2xx(me, "GET /auth/me")
    user_id = me.json()["id"]

    r = session.post(
        f"{API}/user_weights/",
        json={"user_id": user_id, "weight_kg": 75.5, "note": "uw-crud"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "POST /user_weights/")
    wid = str(r.json().get("id") or "")
    assert wid, r.text

    r = session.get(f"{API}/user_weights/{wid}", timeout=TIMEOUT)
    assert_2xx(r, "GET /user_weights/{id}")

    r = session.put(
        f"{API}/user_weights/{wid}",
        json={"weight_kg": 76.0, "note": "uw-updated"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PUT /user_weights/{id}")

    r = session.delete(
        f"{API}/user_weights/{wid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /user_weights/{id}")


# --- /api/v1/workouts (фильтр по user) ---


def test_workouts_list_filtered_by_user_query_2xx() -> None:
    session, email, username, password = register_session()
    me = session.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert_2xx(me, "GET /auth/me")
    user_id = me.json()["id"]

    w = session.post(
        f"{API}/workouts/",
        json={
            "user_id": user_id,
            "workout_date": "2024-07-01",
            "location": "filter-by-user-test",
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(w, "POST /workouts/")
    wid = str(w.json()["id"])

    r = session.get(
        f"{API}/workouts/",
        params={"user": str(user_id)},
        timeout=TIMEOUT,
    )
    assert_2xx(r, "GET /workouts/?user=")
    body = r.json()
    assert isinstance(body, dict) and "items" in body, body
    lst = body["items"]
    assert isinstance(lst, list)
    assert any(str(item.get("id")) == wid for item in lst), lst

    r = session.delete(
        f"{API}/workouts/{wid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /workouts/{id}")


# --- /api/v1/exercises_in_catalog ---


def test_exercises_in_catalog_list_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/exercises_in_catalog/", timeout=TIMEOUT)
    assert_2xx(r, "GET /exercises_in_catalog/")
    assert isinstance(r.json(), list)


def test_exercises_in_catalog_log_summary_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/exercises_in_catalog/log_summary", timeout=TIMEOUT)
    assert_2xx(r, "GET /exercises_in_catalog/log_summary")
    data = r.json()
    assert isinstance(data.get("totals"), dict)
    assert "total_exercises" in data["totals"]
    assert isinstance(data.get("by_exercise"), list)


def test_exercises_in_catalog_create_get_put_delete_2xx() -> None:
    session, _, _, _ = register_session()
    name = f"it_iso_{uuid.uuid4().hex[:12]}"
    r = session.post(
        f"{API}/exercises_in_catalog/",
        json={"name": name, "notes": "crud-2xx"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "POST /exercises_in_catalog/")
    cid = str(r.json()["id"])

    r = session.get(f"{API}/exercises_in_catalog/{cid}", timeout=TIMEOUT)
    assert_2xx(r, "GET /exercises_in_catalog/{id}")

    r = session.put(
        f"{API}/exercises_in_catalog/{cid}",
        json={"name": name, "notes": "after-put"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "PUT /exercises_in_catalog/{id}")

    r = session.delete(
        f"{API}/exercises_in_catalog/{cid}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r, "DELETE /exercises_in_catalog/{id}")


# --- /api/v1/trainer_clients ---


def test_trainer_clients_list_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/trainer_clients/", timeout=TIMEOUT)
    assert_2xx(r, "GET /trainer_clients/")
    assert isinstance(r.json(), list)


def test_trainer_clients_post_forbidden_for_plain_user() -> None:
    session, _, _, _ = register_session()
    r = session.post(
        f"{API}/trainer_clients/",
        json={"client_id": 1},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert r.status_code == 403, r.text


# --- /api/v1/workout_templates (экран «Планы») ---


def test_workout_templates_list_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/workout_templates/", timeout=TIMEOUT)
    assert_2xx(r, "GET /workout_templates/")
    data = r.json()
    assert isinstance(data.get("items"), list)
    assert len(data["items"]) >= 1
    first = data["items"][0]
    assert isinstance(first.get("id"), int)
    assert "title" in first
    assert "exercises" not in first


def test_workout_templates_detail_chest_tri_2xx() -> None:
    session, _, _, _ = register_session()
    r_list = session.get(f"{API}/workout_templates/", timeout=TIMEOUT)
    assert_2xx(r_list, "GET /workout_templates/")
    items = r_list.json().get("items") or []
    chest = next((x for x in items if x.get("title") == "Грудь + трицепс"), None)
    assert chest is not None, "ожидался демо-шаблон «Грудь + трицепс»"
    template_id = chest["id"]

    r = session.get(f"{API}/workout_templates/{template_id}", timeout=TIMEOUT)
    assert_2xx(r, f"GET /workout_templates/{template_id}")
    data = r.json()
    assert data["id"] == template_id
    assert data["title"] == "Грудь + трицепс"
    assert isinstance(data.get("exercises"), list)
    assert len(data["exercises"]) == 5


def test_workout_templates_detail_not_found_404() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/workout_templates/999999999", timeout=TIMEOUT)
    assert r.status_code == 404, r.text


# --- /api/v1/stats ---


def test_stats_activity_heatmap_2xx() -> None:
    session, _, _, _ = register_session()
    headers = _csrf_access_headers(session)

    light = session.post(
        f"{API}/workouts/",
        json={"workout_date": "2026-04-10", "note": "лёгкий день"},
        headers=headers,
        timeout=TIMEOUT,
    )
    assert_2xx(light, "POST /workouts/ light")

    heavy = session.post(
        f"{API}/workouts/",
        json={"workout_date": "2026-04-11", "note": None},
        headers=headers,
        timeout=TIMEOUT,
    )
    assert_2xx(heavy, "POST /workouts/ heavy base")
    heavy_id = heavy.json()["id"]

    cat = session.post(
        f"{API}/exercises_in_catalog/",
        json={"name": "Stats heatmap squat"},
        headers=headers,
        timeout=TIMEOUT,
    )
    assert_2xx(cat, "POST /exercises_in_catalog/")
    cat_id = cat.json()["id"]

    for order in range(1, 5):
        add = session.post(
            f"{API}/workouts/{heavy_id}/add_exercise/{cat_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert_2xx(add, f"POST add_exercise #{order}")

    r = session.get(
        f"{API}/stats/activity-heatmap",
        params={"date_from": "2026-04-01", "date_to": "2026-04-30"},
        timeout=TIMEOUT,
    )
    assert_2xx(r, "GET /stats/activity-heatmap")
    data = r.json()
    assert data["range"]["start"] == "2026-04-01"
    assert data["range"]["end"] == "2026-04-30"
    assert data["days"]["2026-04-10"]["intensity"] == 1
    assert data["days"]["2026-04-10"]["note"] == "лёгкий день"
    assert data["days"]["2026-04-11"]["intensity"] == 2
    assert data["days"]["2026-04-11"].get("note") in (None, "")


def test_stats_activity_heatmap_date_range_filter_2xx() -> None:
    session, _, _, _ = register_session()
    headers = _csrf_access_headers(session)

    session.post(
        f"{API}/workouts/",
        json={"workout_date": "2026-03-15", "note": "март"},
        headers=headers,
        timeout=TIMEOUT,
    )
    session.post(
        f"{API}/workouts/",
        json={"workout_date": "2026-05-01", "note": "май"},
        headers=headers,
        timeout=TIMEOUT,
    )

    r = session.get(
        f"{API}/stats/activity-heatmap",
        params={"date_from": "2026-04-01", "date_to": "2026-04-30"},
        timeout=TIMEOUT,
    )
    assert_2xx(r, "GET /stats/activity-heatmap?date_from&date_to")
    data = r.json()
    assert data["range"]["start"] == "2026-04-01"
    assert data["range"]["end"] == "2026-04-30"
    assert data["days"] == {}


def test_stats_activity_heatmap_invalid_date_range_422() -> None:
    session, _, _, _ = register_session()
    r = session.get(
        f"{API}/stats/activity-heatmap",
        params={"date_from": "2026-06-01", "date_to": "2025-10-01"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 422, r.text


def test_stats_streaks_rhythm_2xx() -> None:
    session, _, _, _ = register_session()
    headers = _csrf_access_headers(session)

    # Серия из 3 дней + одиночный день раньше.
    for day in ("2026-01-10", "2026-04-01", "2026-04-02", "2026-04-03"):
        w = session.post(
            f"{API}/workouts/",
            json={"workout_date": day},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert_2xx(w, f"POST /workouts/ {day}")

    r = session.get(f"{API}/stats/streaks-rhythm", timeout=TIMEOUT)
    assert_2xx(r, "GET /stats/streaks-rhythm")
    data = r.json()
    assert isinstance(data["current_streak_days"], int)
    assert data["current_streak_days"] >= 0
    assert len(data["best_streaks"]) >= 1
    assert data["best_streaks"][0]["days"] == 3
    assert data["best_streaks"][0]["start"] == "2026-04-01"
    assert data["best_streaks"][0]["end"] == "2026-04-03"


# --- /api/v1/user_weights/diary ---


def test_user_weights_diary_2xx() -> None:
    session, _, _, _ = register_session()
    me = session.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert_2xx(me, "GET /auth/me")
    user_id = me.json()["id"]

    patch = session.patch(
        f"{API}/auth/me",
        json={"height_cm": 190},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(patch, "PATCH /auth/me height_cm")

    create = session.post(
        f"{API}/user_weights/",
        json={
            "user_id": user_id,
            "weight_kg": 80.0,
            "body_fat_percent": 18.5,
            "note": "weight-diary test",
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(create, "POST /user_weights/")
    weight_id = create.json()["id"]

    r = session.get(f"{API}/user_weights/diary", timeout=TIMEOUT)
    assert_2xx(r, "GET /user_weights/diary")
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == weight_id
    assert data[0]["weight_kg"] == 80.0
    assert data[0]["body_fat_percent"] == 18.5
    assert data[0]["body_score"] == 9.9

    older = session.post(
        f"{API}/user_weights/",
        json={
            "user_id": user_id,
            "weight_kg": 85.0,
            "measured_at": "2020-01-15T08:00:00",
            "note": "old weight",
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(older, "POST /user_weights/ older")
    older_id = older.json()["id"]

    filtered = session.get(
        f"{API}/user_weights/diary",
        params={"start_date": "2024-01-01T000000Z"},
        timeout=TIMEOUT,
    )
    assert_2xx(filtered, "GET /user_weights/diary?start_date")
    filtered_data = filtered.json()
    assert isinstance(filtered_data, list)
    assert len(filtered_data) == 1
    assert filtered_data[0]["id"] == weight_id

    bad_range = session.get(
        f"{API}/user_weights/diary",
        params={
            "start_date": "2026-06-01T000000Z",
            "end_date": "2026-01-01T000000Z",
        },
        timeout=TIMEOUT,
    )
    assert bad_range.status_code == 400

    bad_format = session.get(
        f"{API}/user_weights/diary",
        params={"start_date": "not-a-date"},
        timeout=TIMEOUT,
    )
    assert bad_format.status_code == 400

    session.delete(
        f"{API}/user_weights/{weight_id}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    session.delete(
        f"{API}/user_weights/{older_id}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )


# --- /api/v1/plans ---


def test_plans_scheduled_empty_without_current_program_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/plans/scheduled", timeout=TIMEOUT)
    assert_2xx(r, "GET /plans/scheduled")
    assert r.json() == []


def test_plans_scheduled_from_current_program_2xx() -> None:
    session, _, _, _ = register_session()
    r_templates = session.get(f"{API}/workout_templates/", timeout=TIMEOUT)
    assert_2xx(r_templates, "GET /workout_templates/")
    items = r_templates.json().get("items") or []
    assert len(items) >= 2
    template_ids = [items[0]["id"], items[1]["id"]]

    program_body = {
        "name": "Расписание — тест",
        "schedule_type": "week_fixed",
        "days": [
            {
                "slot": 1,
                "kind": "workout",
                "iso_weekday": 1,
                "template_id": template_ids[0],
                "enabled": True,
            },
            {
                "slot": 3,
                "kind": "workout",
                "iso_weekday": 3,
                "template_id": template_ids[1],
                "enabled": True,
            },
        ],
    }
    created = session.post(
        f"{API}/plans/program",
        json=program_body,
        params={"is_current": "true"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert created.status_code == 201, created.text

    r = session.get(f"{API}/plans/scheduled", timeout=TIMEOUT)
    assert_2xx(r, "GET /plans/scheduled")
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    first = data[0]
    assert "date" in first
    assert first.get("status") in ("plan_ready", "draft")
    assert first.get("source") == "from_template"
    assert isinstance(first.get("title"), str)
    assert isinstance(first.get("exercises_count"), int)


_WEEK_FIXED_PROGRAM_BODY = {
    "name": "PPL — 3 тренировки",
    "schedule_type": "week_fixed",
    "days": [
        {
            "slot": 1,
            "kind": "workout",
            "iso_weekday": 1,
            "template_id": 2,
            "enabled": True,
        },
        {
            "slot": 2,
            "kind": "rest",
            "iso_weekday": 2,
            "template_id": None,
            "enabled": False,
        },
        {
            "slot": 3,
            "kind": "workout",
            "iso_weekday": 3,
            "template_id": 3,
            "enabled": True,
        },
        {
            "slot": 4,
            "kind": "rest",
            "iso_weekday": 4,
            "template_id": None,
            "enabled": False,
        },
        {
            "slot": 5,
            "kind": "workout",
            "iso_weekday": 5,
            "template_id": 4,
            "enabled": True,
        },
        {
            "slot": 6,
            "kind": "rest",
            "iso_weekday": 6,
            "template_id": None,
            "enabled": False,
        },
        {
            "slot": 7,
            "kind": "rest",
            "iso_weekday": 7,
            "template_id": None,
            "enabled": False,
        },
    ],
}


def test_plans_program_current_2xx() -> None:
    session, _, _, _ = register_session()
    created = session.post(
        f"{API}/plans/program",
        json=_WEEK_FIXED_PROGRAM_BODY,
        params={"is_current": "true"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert created.status_code == 201, created.text

    r = session.get(f"{API}/plans/program/current", timeout=TIMEOUT)
    assert_2xx(r, "GET /plans/program/current")
    data = r.json()
    assert data["name"] == "PPL — 3 тренировки"
    assert data["schedule_type"] == "week_fixed"
    assert len(data["days"]) == 7
    assert data["days"][0]["slot"] == 1
    assert data["days"][0]["kind"] == "workout"
    assert data["days"][0]["iso_weekday"] == 1
    assert data["days"][0]["template_id"] == 2
    assert data["days"][0]["enabled"] is True
    assert data["id"] == created.json()["id"]


def test_plans_program_current_not_found_404() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/plans/program/current", timeout=TIMEOUT)
    assert r.status_code == 404, r.text


def test_plans_program_list_2xx() -> None:
    session, _, _, _ = register_session()
    created = session.post(
        f"{API}/plans/program",
        json={
            "name": "Трёхдневный сплит",
            "schedule_type": "sequence",
            "days": [
                {
                    "slot": 1,
                    "kind": "workout",
                    "template_id": 5,
                    "enabled": True,
                    "state": "next",
                },
                {
                    "slot": 2,
                    "kind": "workout",
                    "template_id": 4,
                    "enabled": True,
                    "state": None,
                },
            ],
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert created.status_code == 201, created.text
    created_id = created.json()["id"]

    r = session.get(f"{API}/plans/program", timeout=TIMEOUT)
    assert_2xx(r, "GET /plans/program")
    items = r.json()
    assert isinstance(items, list)
    assert len(items) == 1
    assert items[0]["id"] == created_id
    assert items[0]["name"] == "Трёхдневный сплит"
    assert items[0]["schedule_type"] == "sequence"
    assert len(items[0]["days"]) == 2
    assert items[0]["days"][0]["template_id"] == 5


def test_plans_program_create_sequence_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.post(
        f"{API}/plans/program",
        json={
            "name": "IT трёхдневный сплит",
            "schedule_type": "sequence",
            "days": [
                {
                    "slot": 1,
                    "kind": "workout",
                    "template_id": 5,
                    "enabled": True,
                    "state": "next",
                },
                {
                    "slot": 2,
                    "kind": "workout",
                    "template_id": 4,
                    "enabled": True,
                    "state": None,
                },
                {
                    "slot": 3,
                    "kind": "workout",
                    "template_id": 3,
                    "enabled": False,
                    "state": None,
                },
            ],
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert isinstance(data["id"], int)
    assert data["id"] >= 1
    assert data["name"] == "IT трёхдневный сплит"
    assert data["schedule_type"] == "sequence"
    assert len(data["days"]) == 3
    assert data["days"][0]["template_id"] == 5


def test_plans_program_create_cycle_pattern_2xx() -> None:
    session, _, _, _ = register_session()
    r = session.post(
        f"{API}/plans/program",
        json={
            "name": "IT 2on/1off",
            "schedule_type": "cycle_pattern",
            "pattern": {"work": 2, "rest": 1},
            "templates": [2, 3, 4],
        },
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["schedule_type"] == "cycle_pattern"
    assert data["pattern"] == {"work": 2, "rest": 1}
    assert data["templates"] == [2, 3, 4]
    assert "days" not in data


def test_plans_program_get_patch_delete_2xx() -> None:
    session, _, _, _ = register_session()
    created = session.post(
        f"{API}/plans/program",
        json=_WEEK_FIXED_PROGRAM_BODY,
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert created.status_code == 201, created.text
    program_id = created.json()["id"]

    r_get = session.get(f"{API}/plans/program/{program_id}", timeout=TIMEOUT)
    assert_2xx(r_get, f"GET /plans/program/{program_id}")
    assert r_get.json()["name"] == "PPL — 3 тренировки"

    r_patch = session.patch(
        f"{API}/plans/program/{program_id}",
        json={
            "name": "PPL — обновлено",
            "schedule_type": "week_fixed",
            "days": _WEEK_FIXED_PROGRAM_BODY["days"],
        },
        params={"is_current": "true"},
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r_patch, f"PATCH /plans/program/{program_id}")
    assert r_patch.json()["name"] == "PPL — обновлено"

    r_current = session.get(f"{API}/plans/program/current", timeout=TIMEOUT)
    assert_2xx(r_current, "GET /plans/program/current")
    assert r_current.json()["id"] == program_id

    r_delete = session.delete(
        f"{API}/plans/program/{program_id}",
        headers=_csrf_access_headers(session),
        timeout=TIMEOUT,
    )
    assert_2xx(r_delete, f"DELETE /plans/program/{program_id}")

    r_missing = session.get(f"{API}/plans/program/{program_id}", timeout=TIMEOUT)
    assert r_missing.status_code == 404, r_missing.text


def test_plans_program_get_not_found_404() -> None:
    session, _, _, _ = register_session()
    r = session.get(f"{API}/plans/program/999999999", timeout=TIMEOUT)
    assert r.status_code == 404, r.text
