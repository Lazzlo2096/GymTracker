#!/usr/bin/env bash
# Ручное обновление сертификата (cron на хосте: 0 3 * * * /path/to/certbot-renew.sh)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" --profile certbot)

"${COMPOSE[@]}" run --rm --entrypoint "" certbot certbot renew --webroot -w /var/www/certbot
"${COMPOSE[@]}" exec nginx nginx -s reload

echo "renew OK"
