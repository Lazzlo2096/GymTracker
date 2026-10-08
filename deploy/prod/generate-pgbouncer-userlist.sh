#!/usr/bin/env bash
# Синхронизирует pgbouncer/userlist.prod.txt с POSTGRES_* из .env.prod

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${1:-.env.prod}"
OUT="pgbouncer/userlist.prod.txt"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет файла $ENV_FILE. Сначала запустите ./deploy/prod/generate-env.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER не задан}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD не задан}"

printf '"%s" "%s"\n' "$POSTGRES_USER" "$POSTGRES_PASSWORD" >"$OUT"
chmod 600 "$OUT"

echo "Обновлён $OUT"
