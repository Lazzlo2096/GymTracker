# Группы кеширования эндпоинтов (GET)

Реестр для [fastapi-cache2](https://github.com/long2ice/fastapi-cache).  
Группа задаётся декоратором `@mark_cache_group(CacheGroup.*)` в коде; HOT0 **без** `@cached_get`.

| Группа | Redis | TTL (сейчас) | Когда |
|--------|-------|--------------|--------|
| **HOT0** | нет | — | Активная тренировка, каталог, подходы — много записей в сессии |
| **HOT1** | да | 5–60 с | Тренировки, профиль `me` — частые чтения, нужна invalidate |
| **WARM1** | да | 60 с | Залы, вес, тренер–клиент |
| **COLD1** | да | 30–60 с | Карточка упражнения каталога, статус платежа, OAuth start |
| **NONE** | нет | — | Health, промо, идеи, публичные упражнения и т.п. |

Сброс после мутации идёт по пользователю: `invalidate_namespaces_for_user` удаляет ключи `u{id}:*` внутри namespace.

Для всех `/api/v1/*` в `core/app.py` middleware выставляет `Cache-Control: no-store` — иначе браузер/Expo Web кеширует GET по `max-age` от fastapi-cache2 **отдельно** от Redis.

---

## HOT0 — без кеша

| Method | Path | Модуль |
|--------|------|--------|
| GET | `/api/v1/exercises_in_workout/` | `routers/exercise_in_workout.py` |
| GET | `/api/v1/exercises_in_workout/{item_id}` | `routers/exercise_in_workout.py` |
| GET | `/api/v1/exercises_in_catalog/` | `routers/exercise_in_catalog_actions.py` |
| GET | `/api/v1/exercises_in_catalog/log_summary` | `routers/exercise_in_catalog_actions.py` |

Мутации подходов (тоже HOT0 по смыслу, не GET):  
`POST/PUT/PATCH/DELETE` под `/api/v1/exercises_in_workout/{id}/set…` — `routers/exercise_in_workout_set_actions.py`.

---

## HOT1 — кеш + короткий TTL / invalidate

| Method | Path | Namespace | TTL |
|--------|------|-----------|-----|
| GET | `/api/v1/workouts/` | `list-workouts` | 5 с |
| GET | `/api/v1/workouts/{workout_id}` | `get-workout` | 5 с |
| GET | `/api/v1/auth/me` | `me` | 60 с |

Invalidate: `invalidate_workouts_cache()`; `invalidate_me_cache()` — PATCH/avatar профиля.

---

## WARM1 — кеш + invalidate (целевой per-user)

| Method | Path | Namespace | TTL |
|--------|------|-----------|-----|
| GET | `/api/v1/user_gyms/` | `list-user-gyms` | 60 с |
| GET | `/api/v1/trainer_clients/` | `list-trainer-clients` | 60 с |
| GET | `/api/v1/trainer_clients/{link_id}` | `get-trainer-client` | 60 с |
| GET | `/api/v1/user_weights/` | `list-user-weights-crud` | 60 с |

Invalidate: `invalidate_user_gyms_cache()` (включая `me`); `invalidate_user_weights_cache()`;
`invalidate_trainer_clients_cache()`.

---

## COLD1 — редкие изменения в сессии

| Method | Path | Namespace | TTL |
|--------|------|-----------|-----|
| GET | `/api/v1/exercises_in_catalog/{item_id}` | `get-exercise-catalog` | 30 с |
| GET | `/api/v1/auth/oauth/{provider}/start` | `oauth-start` | 60 с |

Invalidate: `invalidate_catalog_cache()` для каталога.

| GET | `/api/v1/payments/yookassa/{payment_id}` | — | **без кеша** (опрос статуса) |

После успешной оплаты: `invalidate_me_cache()` (premium в `/auth/me`).

---

## NONE — без fastapi-cache2

| Method | Path | Модуль |
|--------|------|--------|
| GET | `/api/v1/health` | `routers/health.py` |
| GET | `/api/v1/promo-codes/…` | `routers/promo_codes.py` |
| GET | `/api/v1/feature_ideas/` | `routers/feature_ideas.py` |
| GET | `/api/v1/system_exercises/…` | `routers/system_exercises.py` |
| GET | `/api/v1/public_exercises/…` | `routers/public_exercises.py` |

POST/PUT/PATCH/DELETE нигде не кешируются библиотекой (только GET).
