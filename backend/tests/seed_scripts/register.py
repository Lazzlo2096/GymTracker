"""Регистрация пользователя через POST /api/v1/auth/register.

Usage (из backend/):
  python tests/seed_scripts/register.py

Optional env vars:
  GYMTRACKER_HTTP_BASE   (default: http://127.0.0.1:8000)
  GYMTRACKER_LOGIN       (email; default: example@yandex.com)
  GYMTRACKER_PASSWORD    (default: StrongPass1!)

username берётся из локальной части email (до @).

PowerShell example:
  $env:GYMTRACKER_HTTP_BASE="http://127.0.0.1:8000"
  $env:GYMTRACKER_LOGIN="user@example.com"
  $env:GYMTRACKER_PASSWORD="StrongPass1!"
  python ./tests/seed_scripts/register.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import requests

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from project_config import script_settings

DEFAULT_BASE = "http://127.0.0.1:8000"
DEFAULT_LOGIN = "example@yandex.com"
DEFAULT_PASSWORD = "StrongPass1!"
TIMEOUT = 15


def _json_or_text(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), ensure_ascii=False, indent=2)
    except ValueError:
        return response.text


def username_from_email(email: str) -> str:
    local = email.split("@", 1)[0].strip()
    return (local or "user")[:100]


def main() -> int:
    base_url = script_settings.HTTP_BASE.rstrip("/") or DEFAULT_BASE
    email = script_settings.LOGIN.strip() or DEFAULT_LOGIN
    password = script_settings.PASSWORD or DEFAULT_PASSWORD
    username = username_from_email(email)

    register_url = f"{base_url}/api/v1/auth/register"
    payload = {
        "email": email,
        "username": username,
        "password": password,
    }

    session = requests.Session()
    print(f"POST {register_url}")
    print("payload:", json.dumps({**payload, "password": "***"}, ensure_ascii=False))
    try:
        response = session.post(register_url, json=payload, timeout=TIMEOUT)
        print(f"<- {response.status_code}")
    except requests.RequestException as exc:
        print(f"Ошибка сети: {exc}", file=sys.stderr)
        return 1

    if response.status_code in [200, 201]:
        print(f"Готово: пользователь создан ({email}).")
        return 0

    print(
        f"{_json_or_text(response)}",
        file=sys.stderr,
    )
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
