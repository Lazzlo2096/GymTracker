"""Seed тренировок через POST /api/v1/workouts/ (+ exercises_in_workout) из mock JSON.

Usage (из backend/):
  cd backend && python tests/seed_scripts/login_and_seed_workouts.py

Optional env vars:
  GYMTRACKER_HTTP_BASE   (default: http://127.0.0.1:8000)
  GYMTRACKER_LOGIN       (default: example@yandex.com)
  GYMTRACKER_PASSWORD    (default: StrongPass1!)
  GYMTRACKER_USER_GYM_NAME — если задано, создаёт/берёт зал и ставит user_gym_id

Данные: backend/data/mock/workouts.json
Каждый элемент: workout_date, day_title?, note?, exercises? (для POST /exercises_in_workout/).

PowerShell:
  $env:GYMTRACKER_HTTP_BASE="http://127.0.0.1:8000"
  $env:GYMTRACKER_LOGIN="user@example.com"
  $env:GYMTRACKER_PASSWORD="StrongPass1!"
  cd ./backend
  python ./tests/seed_scripts/login_and_seed_workouts.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

import requests

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from project_config import script_settings

DEFAULT_BASE = "http://127.0.0.1:8000"
DEFAULT_LOGIN = "example@yandex.com"
DEFAULT_PASSWORD = "StrongPass1!"
TIMEOUT = 30
RATE_LIMIT_SLEEP_SEC = 5
RATE_LIMIT_MAX_RETRIES = 8

WORKOUTS_JSON_PATH = _BACKEND_ROOT / "data" / "mock" / "workouts.json"


def _json_or_text(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), ensure_ascii=False, indent=2)
    except ValueError:
        return response.text


def _post_with_rate_limit_retry(
    session: requests.Session,
    url: str,
    *,
    json_payload: dict[str, Any],
    headers: dict[str, str],
) -> requests.Response:
    """POST с повтором: при 429 ждём 5 с и пробуем снова."""
    attempt = 0
    while True:
        response = session.post(
            url,
            json=json_payload,
            headers=headers or None,
            timeout=TIMEOUT,
        )
        if response.status_code != 429:
            return response

        attempt += 1
        if attempt > RATE_LIMIT_MAX_RETRIES:
            return response

        print(
            f"<- 429 rate limit, sleep {RATE_LIMIT_SLEEP_SEC}s "
            f"(retry {attempt}/{RATE_LIMIT_MAX_RETRIES})",
            file=sys.stderr,
        )
        time.sleep(RATE_LIMIT_SLEEP_SEC)


def load_workout_seed_items() -> list[dict[str, Any]]:
    raw = WORKOUTS_JSON_PATH.read_text(encoding="utf-8")
    items = json.loads(raw)
    if not isinstance(items, list):
        raise ValueError(f"{WORKOUTS_JSON_PATH}: ожидался массив JSON")

    result: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"workouts[{index}]: ожидался объект")
        if item.get("workout_date") is None:
            raise ValueError(f"workouts[{index}]: нужен workout_date")
        result.append(item)
    return result


def login(
    session: requests.Session,
    base_url: str,
    login_value: str,
    password_value: str,
) -> dict[str, str]:
    login_url = f"{base_url}/api/v1/auth/login"
    print(f"POST {login_url}")
    response = session.post(
        login_url,
        json={"login": login_value, "password": password_value},
        timeout=TIMEOUT,
    )
    print(f"<- {response.status_code}")
    if response.status_code >= 400:
        print(_json_or_text(response), file=sys.stderr)
        raise RuntimeError("Login failed")

    csrf_access = session.cookies.get("csrf_access_token")
    headers: dict[str, str] = {}
    if csrf_access:
        headers["X-CSRF-TOKEN"] = csrf_access
    return headers


def ensure_user_gym(
    session: requests.Session,
    api_base: str,
    headers: dict[str, str],
    gym_name: str,
) -> int:
    url = f"{api_base}/user_gyms/"
    print(f"\nPOST {url}")
    print("payload:", json.dumps({"name": gym_name}, ensure_ascii=False))
    response = _post_with_rate_limit_retry(
        session,
        url,
        json_payload={"name": gym_name},
        headers=headers,
    )
    print(f"<- {response.status_code}")
    print(_json_or_text(response))
    if response.status_code >= 400:
        raise RuntimeError("Could not create/get user gym")

    body = response.json()
    gym_id = body.get("id") if isinstance(body, dict) else None
    if not isinstance(gym_id, int):
        raise RuntimeError("User gym response has no integer id")
    return gym_id


def create_workout(
    session: requests.Session,
    api_base: str,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> dict[str, Any]:
    url = f"{api_base}/workouts/"
    print(f"\nPOST {url}")
    print("payload:", json.dumps(payload, ensure_ascii=False))
    response = _post_with_rate_limit_retry(
        session,
        url,
        json_payload=payload,
        headers=headers,
    )
    print(f"<- {response.status_code}")
    print(_json_or_text(response))
    if response.status_code >= 400:
        raise RuntimeError(f"POST /workouts/ failed: {response.status_code}")

    body = response.json()
    if not isinstance(body, dict) or not isinstance(body.get("id"), int):
        raise RuntimeError("Ответ POST /workouts/ без integer id")
    return body


def create_exercise_in_workout(
    session: requests.Session,
    api_base: str,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> None:
    url = f"{api_base}/exercises_in_workout/"
    print(f"\nPOST {url}")
    print("payload:", json.dumps(payload, ensure_ascii=False))
    response = _post_with_rate_limit_retry(
        session,
        url,
        json_payload=payload,
        headers=headers,
    )
    print(f"<- {response.status_code}")
    print(_json_or_text(response))
    if response.status_code >= 400:
        raise RuntimeError(
            f"POST /exercises_in_workout/ failed: {response.status_code}"
        )


def main() -> int:
    base_url = script_settings.HTTP_BASE.rstrip("/") or DEFAULT_BASE
    login_value = script_settings.LOGIN.strip() or DEFAULT_LOGIN
    password_value = script_settings.PASSWORD or DEFAULT_PASSWORD

    try:
        items = load_workout_seed_items()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Error loading workouts: {exc}", file=sys.stderr)
        return 2

    api_base = f"{base_url}/api/v1"
    session = requests.Session()

    try:
        headers = login(session, base_url, login_value, password_value)
    except RuntimeError:
        return 1

    default_user_gym_id: int | None = None
    gym_env = script_settings.USER_GYM_NAME.strip()
    if gym_env:
        try:
            default_user_gym_id = ensure_user_gym(
                session, api_base, headers, gym_env
            )
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 1

    print(f"\nSeeding {len(items)} workout(s) from {WORKOUTS_JSON_PATH}")

    has_errors = False
    for index, item in enumerate(items, start=1):
        exercises_raw = item.get("exercises")
        workout_payload: dict[str, Any] = {
            "workout_date": item["workout_date"],
        }
        if item.get("day_title") is not None:
            workout_payload["day_title"] = item["day_title"]
        if item.get("note") is not None:
            workout_payload["note"] = item["note"]
        if default_user_gym_id is not None:
            workout_payload["user_gym_id"] = default_user_gym_id
        elif isinstance(item.get("user_gym_id"), int):
            workout_payload["user_gym_id"] = item["user_gym_id"]

        try:
            created = create_workout(session, api_base, headers, workout_payload)
            workout_id = created["id"]
            print(
                f"OK workout #{index}: id={workout_id} "
                f"date={workout_payload['workout_date']!r} "
                f"title={workout_payload.get('day_title')!r}"
            )
        except RuntimeError as exc:
            print(f"FAIL workout #{index}: {exc}", file=sys.stderr)
            has_errors = True
            continue

        if not isinstance(exercises_raw, list):
            continue

        for ex_index, exercise in enumerate(exercises_raw, start=1):
            if not isinstance(exercise, dict):
                print(
                    f"FAIL workout #{index} exercise #{ex_index}: не объект",
                    file=sys.stderr,
                )
                has_errors = True
                continue

            exercise_payload = dict(exercise)
            exercise_payload["workout_id"] = workout_id
            exercise_payload["order_index"] = exercise_payload.get(
                "order_index", ex_index
            )
            if "sets_json" not in exercise_payload and "timeline" in exercise_payload:
                exercise_payload["sets_json"] = exercise_payload.pop("timeline")

            try:
                create_exercise_in_workout(
                    session, api_base, headers, exercise_payload
                )
                print(f"OK exercise #{ex_index} for workout id={workout_id}")
            except RuntimeError as exc:
                print(
                    f"FAIL workout #{index} exercise #{ex_index}: {exc}",
                    file=sys.stderr,
                )
                has_errors = True

    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
