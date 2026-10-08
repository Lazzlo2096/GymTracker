"""Login and create exercise_in_catalog entries via HTTP API.

Usage (из backend/):
  python tests/seed_scripts/login_and_create_exercise_in_catalog.py

Optional env vars:
  GYMTRACKER_HTTP_BASE   (default: http://127.0.0.1:8000)
  GYMTRACKER_LOGIN       (default: example@yandex.com)
  GYMTRACKER_PASSWORD    (default: StrongPass1!)

PowerShell example:
  $env:GYMTRACKER_HTTP_BASE="http://127.0.0.1:8000"
  $env:GYMTRACKER_LOGIN="user@example.com"
  $env:GYMTRACKER_PASSWORD="StrongPass1!"
  python ./backend/tests/seed_scripts/login_and_create_exercise_in_catalog.py
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

# Example payload(s) for POST /api/v1/exercises_in_catalog/
EXERCISE_PAYLOADS: list[dict[str, Any]] = [
    {
        "name": "Тяга верхнего блока широким хватом",
        "notes": "Контролируй негатив 2-3 секунды, лопатки вниз и назад.",
        "muscle_group": "спина",
        "machine_location": "зал A, ряд 2, тренажер 5",
        "machine_settings": {
            "seat_height": 3,
            "knee_pad": 5,
            "grip": "wide_overhand",
        },
        "icon": "pulldown",
        "image": None,
    }
]


def _json_or_text(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), ensure_ascii=False, indent=2)
    except ValueError:
        return response.text


def login(
    session: requests.Session, base_url: str, login_value: str, password_value: str
) -> dict[str, str]:
    """Login and return headers for authenticated unsafe requests."""
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


def create_exercise_in_catalog(
    session: requests.Session,
    base_url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> requests.Response:
    """POST /api/v1/exercises_in_catalog/ with provided payload."""
    url = f"{base_url}/api/v1/exercises_in_catalog/"
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
    return response


def main() -> int:
    base_url = script_settings.HTTP_BASE.rstrip("/") or DEFAULT_BASE
    login_value = script_settings.LOGIN.strip() or DEFAULT_LOGIN
    password_value = script_settings.PASSWORD or DEFAULT_PASSWORD

    session = requests.Session()
    try:
        headers = login(session, base_url, login_value, password_value)
    except RuntimeError:
        return 1

    has_errors = False
    for payload in EXERCISE_PAYLOADS:
        response = create_exercise_in_catalog(session, base_url, headers, payload)
        if response.status_code >= 400:
            has_errors = True

    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
