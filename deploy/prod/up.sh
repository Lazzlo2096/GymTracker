#!/usr/bin/env bash
# Поднять псевдо-prod стек (Postgres, Redis, backend, mobile-web, nginx, мониторинг).
#
#   ./deploy/prod/up.sh
#   ENV_FILE=/etc/gymtracker/.env.prod ./deploy/prod/up.sh
#   ./deploy/prod/up.sh backend mobile-web   # только эти сервисы
#   SKIP_BUILD=1 ./deploy/prod/up.sh         # без пересборки образов

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE." >&2
  echo "Сгенерируйте окружение: ./deploy/prod/generate-env.sh" >&2
  exit 1
fi

echo "==> Дополнение $ENV_FILE (только недостающие ключи)"
./deploy/prod/patch-env.sh "$ENV_FILE"

echo "==> PgBouncer userlist / pgAdmin servers"
./deploy/prod/generate-pgbouncer-userlist.sh "$ENV_FILE"
./deploy/prod/generate-pgadmin-servers.sh "$ENV_FILE"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

if [[ -z "${SKIP_BUILD:-}" ]]; then
  if [[ $# -gt 0 ]]; then
    echo "==> docker compose build: $*"
    "${COMPOSE[@]}" build "$@"
  else
    echo "==> docker compose build (все сервисы с Dockerfile)"
    "${COMPOSE[@]}" build
  fi
else
  echo "==> SKIP_BUILD=1 — образы не пересобираем"
fi

echo "==> docker compose up -d (без --force-recreate; перезапуск только при смене образа/конфига)"
"${COMPOSE[@]}" up -d "$@"

echo ""
echo "Ожидание healthcheck Redis и Postgres (до ~60 с)…"
deadline=$((SECONDS + 60))
while [[ $SECONDS -lt $deadline ]]; do
  redis_ok=0
  pg_ok=0
  if "${COMPOSE[@]}" exec -T redis_container redis-cli ping 2>/dev/null | grep -q PONG; then
    redis_ok=1
  fi
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$(grep ^POSTGRES_USER= "$ENV_FILE" | cut -d= -f2-)" \
    -d "$(grep ^POSTGRES_DB= "$ENV_FILE" | cut -d= -f2-)" >/dev/null 2>&1; then
    pg_ok=1
  fi
  if [[ "$redis_ok" -eq 1 && "$pg_ok" -eq 1 ]]; then
    echo "Redis и Postgres готовы."
    break
  fi
  sleep 2
done

if [[ $SECONDS -ge $deadline ]]; then
  echo "Предупреждение: не дождались healthy Redis/Postgres. Проверьте логи:" >&2
  echo "  ${COMPOSE[*]} ps" >&2
  echo "  ${COMPOSE[*]} logs redis_container backend" >&2
fi

echo ""
"${COMPOSE[@]}" ps
echo ""
echo "Логи backend: ${COMPOSE[*]} logs -f --tail=80 backend"
echo "Панели: https://$(grep ^PUBLIC_DOMAIN= "$ENV_FILE" | cut -d= -f2-)/tools/"
echo "Redis Insight: …/redis/  (или localhost:\${REDIS_GUI_PORT:-5540} с сервера)"
echo "HTTPS (после DNS): ./deploy/prod/certbot-init.sh"
