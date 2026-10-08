"""Simple helper: login and create several workouts via HTTP API.

Usage (из backend/):
  python tests/seed_scripts/login_and_create_workout.py

Optional env vars:
  GYMTRACKER_HTTP_BASE   (default: http://127.0.0.1:8000)
  GYMTRACKER_LOGIN       (default: example@yandex.com)
  GYMTRACKER_PASSWORD    (default: StrongPass1!)
  GYMTRACKER_USER_GYM_NAME — если задано, перед созданием тренировок вызывается POST /user_gyms/
    и в каждый POST /workouts/ добавляется user_gym_id.

PowerShell example:
  $env:GYMTRACKER_HTTP_BASE="http://127.0.0.1:8000"
  $env:GYMTRACKER_LOGIN="user@example.com"
  $env:GYMTRACKER_PASSWORD="StrongPass1!"
  python ./backend/tests/seed_scripts/login_and_create_workout.py
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
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

mocked_exercise_in_catalog_id = 1

# Change or extend this list directly in code.
WORKOUT_PAYLOADS: list[dict[str, Any]] = [
    # {
    #    "workout_date": date.today().isoformat(),
    #    "location": "gym-main",
    #    "day_title": "Upper Body",
    #    "note": "Created by script: variant 1",
    # },
    # {
    #    "workout_date": (date.today() - timedelta(days=1)).isoformat(),
    #    "location": "home",
    #    "day_title": "Leg Day",
    #    "note": "Created by script: variant 2",
    # },
    # {
    #    "workout_date": (date.today() - timedelta(days=2)).isoformat(),
    #    "location": "outdoor",
    #    "day_title": "Cardio + Core",
    #    "note": "Created by script: variant 3",
    # },
    {
        # "type": "workout",
        ## "id": "workout_2026_04_25_001",
        "workout_date": "2026-04-25",
        "day_title": "Custom timeline workout",
        "note": "Большой payload с timeline, exercise, set/rest/comment/mark",
        "timeline": [
            {
                # тут ты должен вставлять отданный тебе id созданного workout от бекенда (через функцию помошника)
                # DONE
                "type": "mark",
                "mark_type": "start",
                "datetime": "2026-04-25T10:00:00",
                "comment": "начало трени, я вот только что вошёл в зал",
            },
            {
                "type": "comment",
                "datetime": "2026-04-25T10:15:00",
                "comment": "запизделся с товарищем лол...",
            },
            {
                #### "type": "exercise",
                ##"id": "workout_2026_04_25_001_exercise_001",
                "exercise_in_catalog_id": mocked_exercise_in_catalog_id,
                #### "current_machine_settings": {
                ####    "seat_height": 3,
                ####    "leg_roller": 5,
                ####    "handle": "широкая прямая",
                ####    "grip": "чуть шире плеч",
                ####    "body_position": "почти вертикально",
                #### },
                #### "technique_note": "Негатив медленный, 2-3 секунды. Внизу короткая фиксация.",
                "timeline": [
                    {
                        # тут ты должен вставлять отданный тебе id созданного exercise от бекенда (через функцию помошника)
                        "type": "mark",
                        "mark_type": "start",
                        "datetime": "2025-04-25T10:18:00",
                        "comment": "в это время начался первый подход",
                    },
                    {
                        "type": "set",
                        "weight_kg": 10,
                        "reps": 8,
                        "comment": None,
                        "set_seconds": 60,
                        "heart_rate_right_after": 138,
                        "rating": 4,
                        # "отказ": True,
                    },
                    {
                        "type": "comment",
                        "datetime": "2026-04-25T10:15:00",
                        # "creation_datetime": "2026-04-25T10:15:00",
                        "comment": "комментарий во время отдыха",
                    },
                    {
                        "type": "comment",
                        "datetime": "2026-04-25T10:15:01",
                        # "creation_datetime": "2026-04-26T20:15:00",
                        "comment": "поздний комментарий к событию",
                    },
                    {
                        "type": "rest",
                        "rest_seconds": 120,
                        "comment": "долго ждал турник",
                    },
                    {
                        "type": "set",
                        "weight_kg": 10,
                        "reps": 7,
                        "comment": "тяжело пошло",
                        "set_seconds": 60,
                    },
                    {
                        "type": "mark",
                        "mark_type": "end",
                        "datetime": "2025-03-10T10:25:00",
                        "comment": "конец блока упражнения",
                    },
                ],
            },
            {
                "type": "comment",
                "datetime": "2025-03-10T10:30:00",
                "comment": "отлучился на пару минут",
            },
            {
                "type": "comment",
                "datetime": "2025-03-10T10:35:00",
                "comment": "перекусил творога, набрался сил",
            },
            {
                "type": "exercise",
                "id": "workout_2026_04_25_001_exercise_003",
                "exercise_in_catalog_id": None,
                "exercise_kind": "cardio",
                "title": "беговая дорожка какая-то",
                "settings": "сложность 5, подъём в горку 2, особая техника бега",
                "goal": "пробежать 5 км со скоростью 5 км/ч",
                "timeline": [
                    {
                        "type": "mark",
                        "mark_type": "start",
                        "datetime": "2025-04-25T10:45:00",
                        "comment": None,
                    },
                    {
                        "type": "mark",
                        "mark_type": "end",
                        "datetime": "2025-03-10T10:50:00",
                        "comment": None,
                    },
                ],
            },
            {
                "type": "mark",
                "mark_type": "end",
                "datetime": "2025-03-10T10:25:00",
                "comment": "конец тренировки",
            },
        ],
    },
]


def _json_or_text(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), ensure_ascii=False, indent=2)
    except ValueError:
        return response.text


def _build_exercise_payload(
    timeline_item: Any,
    workout_id: int,
    order_index: int,
) -> dict[str, Any] | None:
    """Build one POST /exercises_in_workout payload from workout timeline item."""
    if not isinstance(timeline_item, dict):
        return None
    payload = dict(timeline_item)
    payload["workout_id"] = workout_id
    payload["order_index"] = (
        order_index  # payload.setdefault("order_index", order_index)
    )
    return payload


def _build_exercises_payloads(
    workout_payload: dict[str, Any], workout_id: int
) -> list[dict[str, Any]]:
    """Build raw exercise payloads without renaming keys."""
    result: list[dict[str, Any]] = []
    timeline = workout_payload.get("timeline")

    if isinstance(timeline, list):
        for item in timeline:
            payload = _build_exercise_payload(
                timeline_item=item,
                workout_id=workout_id,
                order_index=len(result) + 1,
            )
            if payload is not None:
                result.append(payload)

    return result


def main() -> int:
    base_url = script_settings.HTTP_BASE.rstrip("/") or DEFAULT_BASE
    login_value = script_settings.LOGIN.strip() or DEFAULT_LOGIN
    password_value = script_settings.PASSWORD or DEFAULT_PASSWORD

    api_base = f"{base_url}/api/v1"
    login_url = f"{api_base}/auth/login"
    workouts_url = f"{api_base}/workouts/"
    exercises_in_workout_url = f"{api_base}/exercises_in_workout/"

    session = requests.Session()

    print(f"POST {login_url}")
    login_resp = session.post(
        login_url,
        json={"login": login_value, "password": password_value},
        timeout=TIMEOUT,
    )
    print(f"<- {login_resp.status_code}")
    if login_resp.status_code >= 400:
        print(_json_or_text(login_resp), file=sys.stderr)
        return 1

    csrf_access = session.cookies.get("csrf_access_token")
    headers: dict[str, str] = {}
    if csrf_access:
        headers["X-CSRF-TOKEN"] = csrf_access

    default_user_gym_id: int | None = None
    gym_env = script_settings.USER_GYM_NAME.strip()
    if gym_env:
        user_gyms_url = f"{api_base}/user_gyms/"
        print(f"\nPOST {user_gyms_url}")
        print("payload:", json.dumps({"name": gym_env}, ensure_ascii=False))
        ug_resp = session.post(
            user_gyms_url,
            json={"name": gym_env},
            headers=headers or None,
            timeout=TIMEOUT,
        )
        print(f"<- {ug_resp.status_code}")
        print(_json_or_text(ug_resp))
        if ug_resp.status_code >= 400:
            print("Could not create/get user gym; abort.", file=sys.stderr)
            return 1
        try:
            ug_body = ug_resp.json()
            gid = ug_body.get("id")
            if isinstance(gid, int):
                default_user_gym_id = gid
        except ValueError:
            print("User gym response is not JSON", file=sys.stderr)
            return 1

    has_errors = False
    for index, workout_payload in enumerate(WORKOUT_PAYLOADS, start=1):
        workout_timeline = workout_payload.get("timeline")
        workout_payload_for_post = {
            k: v for k, v in workout_payload.items() if k != "timeline"
        }  # Удаляем поле "timeline" из workout_payload
        if default_user_gym_id is not None:
            workout_payload_for_post["user_gym_id"] = default_user_gym_id
            workout_payload_for_post.pop("location", None)

        print(f"\nPOST {workouts_url} [payload #{index}]")
        print("payload:", json.dumps(workout_payload_for_post, ensure_ascii=False))
        create_resp = session.post(
            workouts_url,
            json=workout_payload_for_post,
            headers=headers or None,
            timeout=TIMEOUT,
        )
        print(f"<- {create_resp.status_code}")
        print(_json_or_text(create_resp))
        if create_resp.status_code >= 400:
            has_errors = True
            continue

        try:
            created_workout = create_resp.json()
        except ValueError:
            print("Could not parse workout create response as JSON", file=sys.stderr)
            has_errors = True
            continue

        workout_id = created_workout.get("id")
        if not isinstance(workout_id, int):
            print(
                "Workout response has no integer id; skip exercise creation",
                file=sys.stderr,
            )
            has_errors = True
            continue

        if not isinstance(workout_timeline, list):
            continue

        for exercise_idx, exercise in enumerate(workout_timeline, start=1):

            print(f"Exercise #{exercise_idx}: {exercise}")
            exercise_payload = _build_exercise_payload(
                exercise, workout_id, exercise_idx
            )
            if exercise_payload is None:
                print("Exercise payload is None; skip exercise creation")
                continue

            print(
                f"\nPOST {exercises_in_workout_url} [workout #{workout_id}, exercise #{exercise_idx}]"
            )
            print("payload:", json.dumps(exercise_payload, ensure_ascii=False))
            create_ex_resp = session.post(
                exercises_in_workout_url,
                json=exercise_payload,
                headers=headers or None,
                timeout=TIMEOUT,
            )
            print(f"<- {create_ex_resp.status_code}")
            print(_json_or_text(create_ex_resp))
            if create_ex_resp.status_code >= 400:
                has_errors = True

    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
