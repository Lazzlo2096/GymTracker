#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
# shellcheck source=dev-compose-env.sh
source "$(dirname "$0")/dev-compose-env.sh"

repair_postgres_devnet_if_needed

if docker compose version &>/dev/null; then
  docker compose "${DEV_COMPOSE_FILES[@]}" up -d --build
elif command -v docker-compose &>/dev/null; then
  docker-compose "${DEV_COMPOSE_FILES[@]}" up -d --build
else
  echo "Ошибка: нужен Docker Compose"
  exit 1
fi

sync_mobile_env_local

echo "Backend API: http://127.0.0.1:${DEV_API_PORT}/docs"
