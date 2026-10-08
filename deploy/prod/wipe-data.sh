#!/usr/bin/env bash
# Удалить все данные псевдо-prod (БД, media, TLS не трогает certbot_certs по умолчанию).
# Использование: ./deploy/prod/wipe-data.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

read -r -p "Удалить volumes postgres_data и backend_media? [y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "Отмена."
  exit 0
fi

"${COMPOSE[@]}" down
docker volume rm -f gymtracker-prod_postgres_data gymtracker-prod_backend_media 2>/dev/null || true
echo "Данные удалены. Поднимите стек: ./deploy/prod/up.sh"
