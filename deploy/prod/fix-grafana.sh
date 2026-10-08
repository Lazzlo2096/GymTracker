#!/usr/bin/env bash
# Сброс Grafana (старый root_url в volume даёт HTTP 400 за прокси).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE" >&2
  exit 1
fi

read -r -p "Удалить данные Grafana (дашборды) и пересоздать контейнер? [y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "Отмена."
  exit 0
fi

"${COMPOSE[@]}" stop grafana
docker volume rm -f gymtracker-prod_grafana_data 2>/dev/null || true
"${COMPOSE[@]}" up -d grafana nginx
sleep 3
"${COMPOSE[@]}" logs --tail=15 grafana
echo ""
echo "Откройте: https://habitpro.ru/grafana/ (логин в CREDS.generated.txt)"
