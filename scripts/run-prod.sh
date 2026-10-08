#!/usr/bin/env bash
# Запуск prod-окружения и вывод адресов сервисов

set -e
cd "$(dirname "$0")/.."

echo "=== Запуск prod (docker compose) ==="
docker compose -f docker-compose.prod.yml up -d --build 2>/dev/null || docker-compose -f docker-compose.prod.yml up -d --build

echo ""
echo "Ожидание запуска контейнеров..."
sleep 8

# IP хоста для доступа с других устройств
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
BASE_URL="http://localhost"
BASE_URL_IP="http://${HOST_IP}"

echo ""
echo "=============================================="
echo "  GymTracker PROD — сервисы запущены"
echo "=============================================="
echo ""
echo "Сервис              | localhost              | Сеть ($HOST_IP)"
echo "--------------------+------------------------+------------------------"
printf "Приложение          | %-22s | %s\n" "$BASE_URL"          "$BASE_URL_IP"
printf "PostgreSQL          | %-22s | %s:5432\n" "localhost:5432" "$HOST_IP:5432"
echo "=============================================="
echo ""
echo "Логи: make logs-prod"
echo "Стоп: make down"
echo ""
