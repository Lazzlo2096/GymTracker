#!/usr/bin/env bash
# Первичный деплой с нуля: generate-env → up → подсказка по certbot.
#
#   ./deploy/prod/bootstrap.sh
#   PUBLIC_DOMAIN=demo.example.com ./deploy/prod/bootstrap.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> Генерация $ENV_FILE"
  ./deploy/prod/generate-env.sh "$ENV_FILE"
else
  echo "==> $ENV_FILE уже есть, пропуск generate-env (удалите файл или --force в generate-env.sh)"
  ./deploy/prod/patch-env.sh "$ENV_FILE"
fi

echo "==> Запуск стека"
./deploy/prod/up.sh

DOMAIN="$(grep ^PUBLIC_DOMAIN= "$ENV_FILE" | cut -d= -f2-)"
echo ""
echo "Bootstrap завершён."
echo "  HTTP:  http://${DOMAIN}/"
echo "  Далее: ./deploy/prod/certbot-init.sh"
echo "  Учётки: deploy/prod/CREDS.generated.txt"
