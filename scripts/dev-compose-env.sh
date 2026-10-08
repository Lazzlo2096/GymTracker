# shellcheck shell=bash
# Определяет файлы compose и порт API для dev (source из run-dev.sh / dev-up.sh).

DEV_COMPOSE_FILES=(-f docker-compose.dev.yml)
DEV_API_PORT=8000

dev_api_looks_like_gymtracker() {
  local port="$1"
  local body
  body="$(curl -sf --max-time 3 "http://127.0.0.1:${port}/docs" 2>/dev/null | head -c 800)" || return 1
  echo "$body" | grep -qiE 'openapi|swagger|fastapi'
}

host_port_in_use() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -tln 2>/dev/null | grep -qE ":${port}([[:space:]]|$)"
    return
  fi
  if command -v netstat &>/dev/null; then
    netstat -tln 2>/dev/null | grep -qE ":${port}([[:space:]]|$)"
    return
  fi
  return 1
}

# Сначала ищем уже запущенный gymtracker; иначе — alt-порты, если 8000 занят чужим сервисом.
if dev_api_looks_like_gymtracker 8000; then
  DEV_API_PORT=8000
elif dev_api_looks_like_gymtracker 8001; then
  DEV_API_PORT=8001
  DEV_COMPOSE_FILES+=(-f docker-compose.dev.alt-ports.yml)
elif host_port_in_use 8000; then
  echo "⚠ Порт 8000 занят не gymtracker — поднимаем API на :8001 (docker-compose.dev.alt-ports.yml)" >&2
  DEV_COMPOSE_FILES+=(-f docker-compose.dev.alt-ports.yml)
  DEV_API_PORT=8001
fi

write_mobile_env_local() {
  local port="$1"
  local env_file="mobile/.env.local"
  mkdir -p mobile
  cat >"$env_file" <<EOF
# Сгенерировано scripts/dev-*.sh — порт API gymtracker на хосте
EXPO_PUBLIC_API_URL=http://127.0.0.1:${port}
EOF
  echo "→ Mobile: $env_file → http://127.0.0.1:${port} (эмулятор: http://10.0.2.2:${port})" >&2
}

sync_mobile_env_local() {
  write_mobile_env_local "$DEV_API_PORT"
}

# Postgres иногда остаётся без сети devnet (прерванный up / конфликт портов) — db-migrate падает с
# «could not translate host name "postgres"».
repair_postgres_devnet_if_needed() {
  if ! docker inspect gymtracker_postgres_dev &>/dev/null; then
    return 0
  fi
  local net_count
  net_count="$(docker inspect gymtracker_postgres_dev --format '{{len .NetworkSettings.Networks}}' 2>/dev/null || echo 0)"
  if [ "$net_count" != "0" ]; then
    return 0
  fi
  echo "⚠ Postgres без сети devnet — пересоздаём контейнер (иначе db-migrate не подключится)..." >&2
  if docker compose version &>/dev/null; then
    docker compose "${DEV_COMPOSE_FILES[@]}" up -d --force-recreate postgres
  else
    docker-compose "${DEV_COMPOSE_FILES[@]}" up -d --force-recreate postgres
  fi
}
