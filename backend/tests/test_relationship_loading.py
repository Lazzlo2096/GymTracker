"""Связи ORM грузятся только явно: авторизация не тянет за собой данные пользователя."""

from sqlalchemy import update

from api_helpers import API, count_queries, register_user
from db.models.postgres import User
from db.models.postgres.user_role import UserRole


async def _create_gym(client, user, name: str = "Зал у дома") -> int:
    r = await client.post(f"{API}/user_gyms/", json={"name": name}, headers=user.headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _create_catalog_exercise(client, user, name: str, **fields) -> int:
    r = await client.post(
        f"{API}/exercises_in_catalog/",
        json={"name": name, **fields},
        headers=user.headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


async def _log_workout(client, user, *, day: str, catalog_id: int, weight: float, reps: int):
    w = await client.post(f"{API}/workouts/", json={"workout_date": day}, headers=user.headers)
    assert w.status_code == 201, w.text
    added = await client.post(
        f"{API}/workouts/{w.json()['id']}/add_exercise/{catalog_id}", headers=user.headers
    )
    assert added.status_code == 200, added.text
    s = await client.post(
        f"{API}/exercises_in_workout/{added.json()['exercise_id']}/set",
        json={"type": "set", "weight_kg": weight, "reps": reps},
        headers=user.headers,
    )
    assert s.status_code == 200, s.text
    return w.json()["id"]


async def test_authenticated_request_loads_only_user_row(client):
    user = await register_user(client)
    gym_id = await _create_gym(client, user)
    for day in ("2026-05-01", "2026-05-02", "2026-05-03"):
        r = await client.post(
            f"{API}/workouts/",
            json={"workout_date": day, "user_gym_id": gym_id},
            headers=user.headers,
        )
        assert r.status_code == 201, r.text
    r = await client.post(f"{API}/user_weights/", json={"weight_kg": 80}, headers=user.headers)
    assert r.status_code == 201, r.text

    with count_queries() as statements:
        r = await client.get(f"{API}/plans/program", headers=user.headers)

    assert r.status_code == 200, r.text
    assert len(statements) == 2, "\n\n".join(statements)


async def test_profile_shows_preferred_gym_and_forgets_it_after_archive(client):
    user = await register_user(client)
    gym_id = await _create_gym(client, user)

    r = await client.patch(
        f"{API}/auth/me",
        json={"preferred_user_gym_id": gym_id, "height_cm": 180},
        headers=user.headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["preferred_gym"] == {"id": gym_id, "name": "Зал у дома", "address": None}

    r = await client.delete(f"{API}/user_gyms/{gym_id}", headers=user.headers)
    assert r.status_code == 200, r.text

    me = (await client.get(f"{API}/auth/me", headers=user.headers)).json()
    assert me["preferred_user_gym_id"] is None
    assert me["preferred_gym"] is None
    assert me["height_cm"] == 180


async def test_weight_diary_uses_height_from_profile(client):
    user = await register_user(client)
    await client.patch(f"{API}/auth/me", json={"height_cm": 180}, headers=user.headers)
    r = await client.post(f"{API}/user_weights/", json={"weight_kg": 81}, headers=user.headers)
    assert r.status_code == 201, r.text

    r = await client.get(f"{API}/user_weights/diary", headers=user.headers)

    assert r.status_code == 200, r.text
    [measurement] = r.json()
    assert measurement["weight_kg"] == 81
    assert measurement["body_score"] is not None


async def test_trainer_lists_client_catalog_with_gym(client, db_session):
    trainer = await register_user(client)
    member = await register_user(client)
    await db_session.execute(
        update(User).where(User.id == trainer.id).values(role=UserRole.trainer)
    )
    await db_session.commit()

    gym_id = await _create_gym(client, member)
    exercise_id = await _create_catalog_exercise(client, member, "Жим лёжа")
    r = await client.patch(
        f"{API}/exercises_in_catalog/{exercise_id}",
        json={"user_gym_id": gym_id},
        headers=member.headers,
    )
    assert r.status_code == 200, r.text
    r = await client.post(
        f"{API}/trainer_clients/", json={"client_id": member.id}, headers=trainer.headers
    )
    assert r.status_code == 201, r.text

    r = await client.get(
        f"{API}/exercises_in_catalog/", params={"owner": member.id}, headers=trainer.headers
    )

    assert r.status_code == 200, r.text
    assert [(e["id"], e["user_gym"]) for e in r.json()] == [
        (exercise_id, {"id": gym_id, "name": "Зал у дома"})
    ]


async def test_template_detail_takes_names_from_catalog_and_feeds_schedule(client):
    user = await register_user(client)
    gym_id = await _create_gym(client, user)
    squat_id = await _create_catalog_exercise(client, user, "Присед", muscle_group="Ноги")

    r = await client.post(
        f"{API}/workout_templates/",
        json={
            "title": "Ноги",
            "user_gym_id": gym_id,
            "exercises": [
                {"exercise_in_catalog_id": squat_id},
                {"title_override": "Выпады"},
            ],
        },
        headers=user.headers,
    )
    assert r.status_code == 201, r.text
    template = r.json()
    assert template["gym_name"] == "Зал у дома"
    assert [(e["name"], e["muscle_group"]) for e in template["exercises"]] == [
        ("Присед", "Ноги"),
        ("Выпады", None),
    ]

    r = await client.patch(
        f"{API}/workout_templates/{template['id']}",
        json={"exercises": [{"exercise_in_catalog_id": squat_id}]},
        headers=user.headers,
    )
    assert r.status_code == 200, r.text
    assert [e["name"] for e in r.json()["exercises"]] == ["Присед"]

    listed = (await client.get(f"{API}/workout_templates/", headers=user.headers)).json()
    assert [(t["title"], t["exercises_count"]) for t in listed["items"]] == [("Ноги", 1)]

    program = {
        "name": "Неделя",
        "schedule_type": "week_fixed",
        "days": [
            {
                "slot": 1,
                "kind": "workout",
                "iso_weekday": weekday,
                "template_id": template["id"],
                "enabled": True,
            }
            for weekday in range(1, 8)
        ],
    }
    r = await client.post(
        f"{API}/plans/program", params={"is_current": "true"}, json=program, headers=user.headers
    )
    assert r.status_code == 201, r.text

    scheduled = (await client.get(f"{API}/plans/scheduled", headers=user.headers)).json()
    assert scheduled
    assert {s["title"] for s in scheduled} == {"Ноги"}
    assert {s["exercises_count"] for s in scheduled} == {1}

    r = await client.delete(f"{API}/workout_templates/{template['id']}", headers=user.headers)
    assert r.status_code == 200, r.text


async def test_public_exercise_carries_author(client):
    author = await register_user(client)
    reader = await register_user(client)
    exercise_id = await _create_catalog_exercise(client, author, "Тяга блока")
    r = await client.post(
        f"{API}/exercises_in_catalog/{exercise_id}/publish", headers=author.headers
    )
    assert r.status_code == 200, r.text
    public_id = r.json()["public_exercise_id"]

    listed = await client.get(f"{API}/public-exercises/", headers=reader.headers)
    one = await client.get(f"{API}/public-exercises/{public_id}", headers=reader.headers)

    expected_author = {"id": author.id, "display_name": author.username}
    assert listed.status_code == 200, listed.text
    assert [p["author"] for p in listed.json()] == [expected_author]
    assert one.status_code == 200, one.text
    assert one.json()["author"] == expected_author


async def test_stats_read_catalog_type_through_explicit_load(client):
    user = await register_user(client)
    bench_id = await _create_catalog_exercise(
        client, user, "Жим лёжа", exercise_type="strength"
    )
    await _log_workout(client, user, day="2026-05-04", catalog_id=bench_id, weight=60, reps=10)

    types = await client.get(f"{API}/stats/workout-types", headers=user.headers)
    top = await client.get(f"{API}/stats/top-exercises", headers=user.headers)
    overview = await client.get(f"{API}/stats/overview", headers=user.headers)

    assert types.status_code == 200, types.text
    assert [(t["id"], t["count"]) for t in types.json()["items"]] == [("strength", 1)]
    assert top.status_code == 200, top.text
    assert [(e["name"], e["tonnage_kg"]) for e in top.json()["items"]] == [("Жим лёжа", 600.0)]
    assert overview.status_code == 200, overview.text
    assert overview.json()["kpi"]["tonnage_kg"] == 600.0


async def test_referral_milestone_grants_owner_premium(client):
    owner = await register_user(client)
    promo = (await client.get(f"{API}/promo-codes/me", headers=owner.headers)).json()
    invitee = await register_user(client, promo_code=promo["code"])
    deadlift_id = await _create_catalog_exercise(client, invitee, "Становая")

    await _log_workout(
        client, invitee, day="2026-05-05", catalog_id=deadlift_id, weight=100, reps=1
    )

    dashboard = (await client.get(f"{API}/promo-codes/me", headers=owner.headers)).json()
    assert dashboard["stats"]["milestone_completed"] == 1
    me = (await client.get(f"{API}/auth/me", headers=owner.headers)).json()
    assert me["premium_lifetime"] is True
    assert me["is_premium"] is True
