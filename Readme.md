# GymTracker

Приложение для учёта тренировок: каталог упражнений, тренировки, подходы, вес пользователя. Клиент — мобильное приложение.

## Стек

- **Backend:** FastAPI, PostgreSQL, Python 3.12
- **Mobile:** Expo / React Native (`mobile/`, см. `mobile/README.md`)
- **БД:** PostgreSQL

## Быстрый старт

### Разработка (Docker)

```bash
make dev
# или: ./scripts/run-dev.sh
```

После запуска скрипт выведет адреса всех сервисов (localhost и IP в сети).

Запускает PostgreSQL, backend, nginx.

- **Backend API:** http://localhost:8000
- **Swagger:** http://localhost:8000/docs
- **API через nginx:** http://localhost/api/

### Production

```bash
make prod
# или: ./scripts/run-prod.sh
```

Скрипт выведет адреса сервисов по окончании запуска.

- **Приложение:** http://localhost

### Остановка

```bash
make down
```

## Запуск без Docker

### Backend

```bash
cd backend
pip install -r requirements.txt
# PostgreSQL должен быть запущен
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Авторизация

JWT access и refresh отдаются в httpOnly cookies и в теле ответа. Мобильный клиент дальше шлёт `Authorization: Bearer`. Проверка CSRF выключена, заголовок `X-CSRF-TOKEN` не нужен.

## Структура проекта

```
gymtracker/
├── backend/          # FastAPI, PostgreSQL
├── mobile/           # Expo / React Native
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── Makefile
```

Подробнее:
- [Backend](backend/README.md)
- [Mobile](mobile/README.md)
