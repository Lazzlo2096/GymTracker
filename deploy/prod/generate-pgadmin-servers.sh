#!/usr/bin/env bash
# Генерирует docker/pgadmin/servers.prod.json с паролем из .env.prod

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${1:-.env.prod}"
OUT="docker/pgadmin/servers.prod.json"

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${POSTGRES_DB:?}"

python3 - <<PY
import json
import os

out = {
    "Servers": {
        "1": {
            "Name": "Gymtracker (postgres)",
            "Group": "Servers",
            "Host": "postgres",
            "Port": 5432,
            "MaintenanceDB": os.environ["POSTGRES_DB"],
            "Username": os.environ["POSTGRES_USER"],
            "Password": os.environ["POSTGRES_PASSWORD"],
            "SSLMode": "prefer",
            "Comment": "Псевдо-prod: прямое подключение к postgres (не PgBouncer).",
        }
    }
}
with open("$OUT", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY

chmod 600 "$OUT"
echo "Обновлён $OUT"
