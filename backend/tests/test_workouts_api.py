"""Сценарии тренировок через API на тестовой БД."""

from api_helpers import API, register_user


async def _create_catalog_exercise(client, user, name: str) -> int:
    r = await client.post(
        f"{API}/exercises_in_catalog/", json={"name": name}, headers=user.headers
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


async def test_workout_lifecycle(client):
    user = await register_user(client)
    gym = await client.post(f"{API}/user_gyms/", json={"name": "Зал"}, headers=user.headers)
    bench_id = await _create_catalog_exercise(client, user, "Жим лёжа")

    created = await client.post(
        f"{API}/workouts/",
        json={"workout_date": "2026-05-10", "day_title": "Грудь", "user_gym_id": gym.json()["id"]},
        headers=user.headers,
    )
    assert created.status_code == 201, created.text
    workout = created.json()
    assert workout["user_id"] == user.id
    assert workout["user_gym"] == {"id": gym.json()["id"], "name": "Зал"}

    added = await client.post(
        f"{API}/workouts/{workout['id']}/add_exercise/{bench_id}", headers=user.headers
    )
    assert added.status_code == 200, added.text
    eiw_id = added.json()["exercise_id"]

    for reps in (10, 8):
        r = await client.post(
            f"{API}/exercises_in_workout/{eiw_id}/set",
            json={"type": "set", "weight_kg": 60, "reps": reps},
            headers=user.headers,
        )
        assert r.status_code == 200, r.text
    assert [s["reps"] for s in r.json()["all_sets"]] == [10, 8]

    detail = await client.get(f"{API}/workouts/{workout['id']}", headers=user.headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["tonnage_kg"] == 60 * 18
    assert [e["exercise_in_catalog_id"] for e in body["exercises"]] == [bench_id]

    listed = await client.get(f"{API}/workouts/", headers=user.headers)
    assert listed.status_code == 200, listed.text
    page = listed.json()
    assert page["total"] == 1
    assert page["items"][0]["user_gym"]["name"] == "Зал"
    assert page["items"][0]["exercises_count"] == 1

    repeated = await client.post(
        f"{API}/workouts/{workout['id']}/repeat",
        json={"workout_date": "2026-05-17"},
        headers=user.headers,
    )
    assert repeated.status_code == 201, repeated.text
    copy = repeated.json()
    assert copy["id"] != workout["id"]
    assert copy["workout_date"] == "2026-05-17"
    assert [e["exercise_in_catalog_id"] for e in copy["exercises"]] == [bench_id]
    assert copy["exercises"][0]["sets_json"] == []
    assert len(copy["exercises"][0]["planned_sets_json"]) == 2

    deleted = await client.delete(f"{API}/workouts/{workout['id']}", headers=user.headers)
    assert deleted.status_code == 200, deleted.text
    gone = await client.get(f"{API}/workouts/{workout['id']}", headers=user.headers)
    assert gone.status_code == 404


async def test_foreign_workout_is_hidden(client):
    owner = await register_user(client)
    stranger = await register_user(client)
    created = await client.post(
        f"{API}/workouts/", json={"workout_date": "2026-05-10"}, headers=owner.headers
    )
    workout_id = created.json()["id"]

    r = await client.get(f"{API}/workouts/{workout_id}", headers=stranger.headers)
    listed = await client.get(f"{API}/workouts/", headers=stranger.headers)

    assert r.status_code == 404
    assert listed.json()["total"] == 0


async def test_create_workout_rejects_unknown_fields(client):
    user = await register_user(client)

    r = await client.post(
        f"{API}/workouts/",
        json={"workout_date": "2026-05-10", "user_id": user.id + 1},
        headers=user.headers,
    )

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", "user_id"]
