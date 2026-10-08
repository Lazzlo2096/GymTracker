#!/usr/bin/env bash
# Починить backend после смены пароля / рассинхрона PgBouncer.
# На псевдо-prod backend подключается к postgres:5432 напрямую.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE" >&2
  exit 1
fi

./deploy/prod/patch-env.sh "$ENV_FILE"
./deploy/prod/generate-pgbouncer-userlist.sh "$ENV_FILE"

echo "Сборка и запуск backend (postgres + redis обязательны)…"
"${COMPOSE[@]}" up -d redis_container
"${COMPOSE[@]}" build backend
"${COMPOSE[@]}" up -d backend
"${COMPOSE[@]}" logs --tail=40 backend
