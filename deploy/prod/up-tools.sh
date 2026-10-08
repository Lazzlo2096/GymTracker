#!/usr/bin/env bash
# Перезапустить только Redis Insight (обычно уже в up.sh).
# UI: https://<домен>/redis/  или  http://localhost:5540/redis/

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE. Сначала: ./deploy/prod/generate-env.sh" >&2
  exit 1
fi

./deploy/prod/patch-env.sh "$ENV_FILE"

exec docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  up -d redis_gui "$@"
