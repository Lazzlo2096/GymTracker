# GymTracker Backend

FastAPI-приложение для API трекера тренировок. Основная БД — PostgreSQL.

## Стек

- Python 3.12
- FastAPI
- SQLAlchemy + asyncpg
- Alembic
- Pydantic

## Структура

```
backend/
├── main.py              # Точка входа
├── core/                # Конфиг и фабрика приложения
├── db/                  # Подключение к БД и модели
│   └── models/postgres/ # Модели SQLAlchemy
├── schemas/             # Pydantic-схемы
├── crud/                # Общие query-схемы для list-эндпоинтов
├── routers/             # API-роутеры
├── alembic/             # Миграции PostgreSQL
│   └── versions/        # Файлы миграций
├── alembic.ini          # Конфиг Alembic
└── requirements.txt
```

## Alembic (миграции PostgreSQL)

```bash
cd backend

# Применить миграции
alembic upgrade head

# Откатить последнюю
alembic downgrade -1

# Новая миграция (после изменения моделей)
alembic revision --autogenerate -m "описание"
```

URL берётся из `DATABASE_URL` (или `alembic.ini`). Для Alembic используется sync-драйвер `psycopg2`.

## Конфигурация (переменные окружения)

Все переменные окружения валидируются через **pydantic-settings** в `project_config.py`:

- `settings` — основное приложение (`.env`, `.env.prod`, `deploy/prod/.env.prod`)
- `script_settings` / `http_test_settings` — префикс `GYMTRACKER_` для скриптов и HTTP-тестов

Импорт: `from project_config import settings` (например `settings.AUTH_SECRET`, `settings.MEDIA_ROOT`).

В `ENVIRONMENT=production` при старте проверяется `AUTH_SECRET` (мин. 32 символа, не дефолт).

## API

- **Swagger UI:** `/docs`
- **ReDoc:** `/redoc`

Эндпоинты под префиксом `/api/v1/`:
- `health` — проверка живости API, PostgreSQL/Redis, CPU/RAM/диск (%); без авторизации; HTTP 503 при `unhealthy`
- `auth/me` — текущий пользователь (JWT в cookies)
- `workouts/` — тренировки
- `exercises_in_catalog/` — каталог упражнений
- `exercises_in_workout/` — упражнения в тренировке, подходы
- `user_weights/` — вес пользователя

## Локальный запуск

### 1. PostgreSQL

PostgreSQL должен быть доступен (локально или через `docker compose`).

### 2. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 3. Переменные окружения (опционально)

| Переменная    | По умолчанию                                              |
|---------------|-----------------------------------------------------------|
| DATABASE_URL  | postgresql+asyncpg://postgres:postgres@localhost:5432/gymtracker |

### 4. Запуск

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
