"""Seed «Дневник веса» via POST /api/v1/user_weights/ from mock JSON.

Usage (из backend/):
  cd backend && python tests/seed_scripts/login_and_seed_weight_diary.py

Optional env vars:
  GYMTRACKER_HTTP_BASE   (default: http://127.0.0.1:8000)
  GYMTRACKER_LOGIN       (default: example@yandex.com)
  GYMTRACKER_PASSWORD    (default: StrongPass1!)

Для body_score на экране /weight-diary нужен рост в профиле (height_cm);
скрипт выставляет 180 см, если рост ещё не задан.

PowerShell:
  $env:GYMTRACKER_HTTP_BASE="http://127.0.0.1:8000"
  $env:GYMTRACKER_LOGIN="user@example.com"
  $env:GYMTRACKER_PASSWORD="StrongPass1!"
  cd ./backend
  python ./tests/seed_scripts/login_and_seed_weight_diary.py
"""

from __future__ import annotations

import json
import sys
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
DEFAULT_HEIGHT_CM = 180
TIMEOUT = 15

WEIGHT_DIARY_JSON_PATH = _BACKEND_ROOT / "data" / "mock" / "weight_diary.json"


def _json_or_text(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), ensure_ascii=False, indent=2)
    except ValueError:
        return response.text


def load_weight_create_payloads() -> list[dict[str, Any]]:
    raw = WEIGHT_DIARY_JSON_PATH.read_text(encoding="utf-8")
    items = json.loads(raw)
    if not isinstance(items, list):
        raise ValueError(f"{WEIGHT_DIARY_JSON_PATH}: ожидался массив JSON")

    payloads: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"weight_diary[{index}]: ожидался объект")
        weight_kg = item.get("weight_kg")
        if weight_kg is None:
            raise ValueError(f"weight_diary[{index}]: нужен weight_kg")
        payload: dict[str, Any] = {"weight_kg": weight_kg}
        if item.get("measured_at") is not None:
            payload["measured_at"] = item["measured_at"]
        if item.get("body_fat_percent") is not None:
            payload["body_fat_percent"] = item["body_fat_percent"]
        if item.get("note") is not None:
            payload["note"] = item["note"]
        payloads.append(payload)
    return payloads


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


def ensure_profile_height(
    session: requests.Session,
    api_base: str,
    headers: dict[str, str],
    *,
    height_cm: int = DEFAULT_HEIGHT_CM,
) -> None:
    me_url = f"{api_base}/auth/me"
    print(f"\nGET {me_url}")
    me_resp = session.get(me_url, timeout=TIMEOUT)
    print(f"<- {me_resp.status_code}")
    if me_resp.status_code >= 400:
        print(_json_or_text(me_resp), file=sys.stderr)
        raise RuntimeError("GET /auth/me failed")

    me = me_resp.json()
    if not isinstance(me, dict):
        raise RuntimeError("Ответ GET /auth/me не объект JSON")
    current_height = me.get("height_cm")
    if isinstance(current_height, (int, float)) and current_height > 0:
        print(f"height_cm уже задан: {current_height}")
        return

    payload = {"height_cm": height_cm}
    print(f"\nPATCH {me_url}")
    print("payload:", json.dumps(payload, ensure_ascii=False))
    patch_resp = session.patch(
        me_url,
        json=payload,
        headers=headers or None,
        timeout=TIMEOUT,
    )
    print(f"<- {patch_resp.status_code}")
    print(_json_or_text(patch_resp))
    if patch_resp.status_code >= 400:
        raise RuntimeError("PATCH /auth/me height_cm failed")


def create_weight_measurement(
    session: requests.Session,
    api_base: str,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> dict[str, Any]:
    url = f"{api_base}/user_weights/"
    print(f"\nPOST {url}")
    print("payload:", json.dumps(payload, ensure_ascii=False))
    response = session.post(
        url,
        json=payload,
        headers=headers or None,
        timeout=TIMEOUT,
    )
    print(f"<- {response.status_code}")
    print(_json_or_text(response))
    if response.status_code >= 400:
        raise RuntimeError(f"POST /user_weights/ failed: {response.status_code}")
    body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError("Ответ POST /user_weights/ не объект JSON")
    return body


def main() -> int:
    base_url = script_settings.HTTP_BASE.rstrip("/") or DEFAULT_BASE
    login_value = script_settings.LOGIN.strip() or DEFAULT_LOGIN
    password_value = script_settings.PASSWORD or DEFAULT_PASSWORD

    try:
        payloads = load_weight_create_payloads()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Error loading weight diary: {exc}", file=sys.stderr)
        return 2

    api_base = f"{base_url}/api/v1"
    session = requests.Session()

    try:
        headers = login(session, base_url, login_value, password_value)
        ensure_profile_height(session, api_base, headers)
    except RuntimeError:
        return 1

    print(f"\nSeeding {len(payloads)} weight measurement(s) from {WEIGHT_DIARY_JSON_PATH}")

    has_errors = False
    for index, payload in enumerate(payloads, start=1):
        try:
            created = create_weight_measurement(session, api_base, headers, payload)
            print(
                f"OK #{index}: id={created.get('id')} "
                f"weight_kg={payload.get('weight_kg')} "
                f"measured_at={payload.get('measured_at')!r}"
            )
        except RuntimeError as exc:
            print(
                f"FAIL #{index} (weight_kg={payload.get('weight_kg')}): {exc}",
                file=sys.stderr,
            )
            has_errors = True

    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
