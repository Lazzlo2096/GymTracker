# GymTracker — команды запуска

# Разработка (сборка + запуск + вывод адресов)
dev:
	# там внутри: `docker compose -f docker-compose.dev.yml up --build -d`
	./scripts/run-dev.sh

# Разработка — только up -d, без пересборки
dev-up:
	./scripts/dev-up.sh

# Production (сборка + запуск + вывод адресов)
prod:
	./scripts/run-prod.sh

# Production — только up -d, без пересборки
prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

# Остановка
down:
	docker compose -f docker-compose.dev.yml down || docker compose -f docker-compose.prod.yml down

logs-dev:
	docker compose -f docker-compose.dev.yml logs -f

logs-prod:
	docker compose -f docker-compose.prod.yml logs -f

# Миграции PostgreSQL (Alembic) — локально: venv с psycopg2 и DATABASE_URL
# (по умолчанию в alembic/env.py — localhost:5437 под docker-compose.dev.yml).
migrate:
	cd backend && python -m alembic upgrade head

migrate-revision:
	cd backend && python -m alembic revision --autogenerate -m "$(or $(msg),auto_migration)"

# Текущая ревизия Alembic на dev-БД в Docker (без локального psycopg2).
migrate-current-compose-dev:
	docker compose -f docker-compose.dev.yml run --rm db-migrate python -m alembic current

# Autogenerate ревизии против той же БД, что и db-migrate (всегда на head после migrate-compose-dev).
migrate-revision-compose-dev:
	docker compose -f docker-compose.dev.yml run --rm db-migrate \
		python -m alembic revision --autogenerate -m "$(or $(msg),auto_migration)"

# Миграции внутри Docker (поднимает зависимости compose при необходимости)
migrate-compose-dev:
	docker compose -f docker-compose.dev.yml run --rm db-migrate

migrate-compose-prod:
	docker compose -f docker-compose.prod.yml run --rm db-migrate
