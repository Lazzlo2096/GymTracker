"""Seed training programs via POST /api/v1/plans/program from mock JSON.

Usage (из backend/):
  cd backend && python tests/seed_scripts/login_and_seed_training_programs.py

Optional env vars:
  GYMTRACKER_HTTP_BASE   (default: http://127.0.0.1:8000)
  GYMTRACKER_LOGIN       (default: example@yandex.com)
  GYMTRACKER_PASSWORD    (default: StrongPass1!)

PowerShell:
  $env:GYMTRACKER_HTTP_BASE="http://127.0.0.1:8000"
  $env:GYMTRACKER_LOGIN="user@example.com"
  $env:GYMTRACKER_PASSWORD="StrongPass1!"
  cd ./backend
  python ./tests/seed_scripts/login_and_seed_training_programs.py
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
TIMEOUT = 15

PROGRAMS_JSON_PATH = _BACKEND_ROOT / "data" / "mock" / "programs.json"


def _json_or_text(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), ensure_ascii=False, indent=2)
    except ValueError:
        return response.text


def load_program_create_payloads() -> list[dict[str, Any]]:
    raw = PROGRAMS_JSON_PATH.read_text(encoding="utf-8")
    items = json.loads(raw)
    if not isinstance(items, list):
        raise ValueError(f"{PROGRAMS_JSON_PATH}: ожидался массив JSON")

    payloads: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"programs[{index}]: ожидался объект")
        payload = {key: value for key, value in item.items() if key != "id"}
        if not payload.get("name") or not payload.get("schedule_type"):
            raise ValueError(f"programs[{index}]: нужны name и schedule_type")
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


def create_training_program(
    session: requests.Session,
    api_base: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    *,
    is_current: bool,
) -> dict[str, Any]:
    url = f"{api_base}/plans/program"
    params = {"is_current": "true"} if is_current else None
    print(f"\nPOST {url}" + ("?is_current=true" if is_current else ""))
    print("payload:", json.dumps(payload, ensure_ascii=False))
    response = session.post(
        url,
        json=payload,
        headers=headers or None,
        params=params,
        timeout=TIMEOUT,
    )
    print(f"<- {response.status_code}")
    print(_json_or_text(response))
    if response.status_code >= 400:
        raise RuntimeError(f"POST /plans/program failed: {response.status_code}")
    body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError("Ответ POST /plans/program не объект JSON")
    return body


def main() -> int:
    base_url = script_settings.HTTP_BASE.rstrip("/") or DEFAULT_BASE
    login_value = script_settings.LOGIN.strip() or DEFAULT_LOGIN
    password_value = script_settings.PASSWORD or DEFAULT_PASSWORD

    try:
        payloads = load_program_create_payloads()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Error loading programs: {exc}", file=sys.stderr)
        return 2

    api_base = f"{base_url}/api/v1"
    session = requests.Session()

    try:
        headers = login(session, base_url, login_value, password_value)
    except RuntimeError:
        return 1

    print(f"\nSeeding {len(payloads)} program(s) from {PROGRAMS_JSON_PATH}")

    has_errors = False
    for index, payload in enumerate(payloads, start=1):
        is_current = index == 1
        try:
            created = create_training_program(
                session,
                api_base,
                headers,
                payload,
                is_current=is_current,
            )
            print(
                f"OK #{index}: id={created.get('id')} "
                f"name={created.get('name')!r} "
                f"schedule_type={created.get('schedule_type')}"
            )
        except RuntimeError as exc:
            print(f"FAIL #{index} ({payload.get('name')!r}): {exc}", file=sys.stderr)
            has_errors = True

    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
