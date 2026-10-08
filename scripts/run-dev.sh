#!/usr/bin/env bash
# Запуск dev-окружения и вывод адресов сервисов

set -e
cd "$(dirname "$0")/.."
# shellcheck source=dev-compose-env.sh
source "$(dirname "$0")/dev-compose-env.sh"

repair_postgres_devnet_if_needed

echo "=== Запуск dev (docker compose) ==="
if docker compose version &>/dev/null; then
  docker compose "${DEV_COMPOSE_FILES[@]}" up -d --build
elif command -v docker-compose &>/dev/null; then
  docker-compose "${DEV_COMPOSE_FILES[@]}" up -d --build
else
  echo "Ошибка: нужен Docker Compose. Установите плагин: sudo dnf install docker-compose-plugin"
  exit 1
fi

sync_mobile_env_local

echo ""
echo "Ожидание запуска контейнеров..."
sleep 5

# IP хоста для доступа с других устройств
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
BASE_URL="http://localhost"
BASE_URL_IP="http://${HOST_IP}"

echo ""
echo "=============================================="
echo "  GymTracker DEV — сервисы запущены"
echo "=============================================="
echo ""
echo "Сервис              | localhost              | Сеть ($HOST_IP)"
echo "--------------------+------------------------+------------------------"
printf "Backend API         | %-22s | %s:%s\n" "$BASE_URL:${DEV_API_PORT}" "$HOST_IP" "$DEV_API_PORT"
printf "API через nginx     | %-22s | %s/api/\n" "$BASE_URL/api/" "$BASE_URL_IP"
printf "Swagger             | %-22s | %s:%s/docs\n" "$BASE_URL:${DEV_API_PORT}/docs" "$HOST_IP" "$DEV_API_PORT"
printf "Grafana             | %-22s | %s:3001\n" "$BASE_URL:3001"   "$HOST_IP"
printf "Prometheus          | %-22s | %s:9090\n" "$BASE_URL:9090"   "$HOST_IP"
printf "pgAdmin             | %-22s | %s:5050\n" "$BASE_URL:5050"   "$HOST_IP"
echo "=============================================="
echo ""
echo "Логи: make logs-dev"
echo "Стоп: make down"
echo ""
