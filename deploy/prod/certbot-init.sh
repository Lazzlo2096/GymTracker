#!/usr/bin/env bash
# Первичное получение Let's Encrypt для habitpro.ru (webroot).
# Требования: DNS A-запись habitpro.ru → IP сервера, открыт порт 80.
#
# Запуск из корня репозитория после:
#   ./deploy/prod/generate-env.sh
#   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" --profile certbot)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE — сначала ./deploy/prod/generate-env.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

DOMAIN="${PUBLIC_DOMAIN:-habitpro.ru}"
EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$EMAIL" ]]; then
  echo "Задайте CERTBOT_EMAIL в $ENV_FILE" >&2
  exit 1
fi

echo "Запрос сертификата для ${DOMAIN} и www.${DOMAIN} …"

"${COMPOSE[@]}" run --rm --entrypoint "" certbot certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  -d "www.${DOMAIN}" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --force-renewal

# Переключение на HTTPS-конфиг nginx
if grep -q '^NGINX_CONF=.*bootstrap' "$ENV_FILE"; then
  sed -i 's|^NGINX_CONF=.*|NGINX_CONF=./nginx/nginx.prod.conf|' "$ENV_FILE"
fi

if grep -q '^NGINX_MONITORING_CONF=.*bootstrap' "$ENV_FILE"; then
  sed -i 's|^NGINX_MONITORING_CONF=.*|NGINX_MONITORING_CONF=./nginx/nginx.prod.monitoring.conf|' "$ENV_FILE"
fi

if grep -q '^COOKIE_SECURE=0' "$ENV_FILE"; then
  sed -i 's|^COOKIE_SECURE=0|COOKIE_SECURE=1|' "$ENV_FILE"
fi

echo "Перезапуск nginx и backend с HTTPS …"
"${COMPOSE[@]}" up -d redis_container redis_gui nginx backend

"${COMPOSE[@]}" exec nginx nginx -t
"${COMPOSE[@]}" exec nginx nginx -s reload

echo ""
echo "Готово. Проверьте: https://${DOMAIN}/"
echo "Для автообновления сертификата:"
echo "  ${COMPOSE[*]} --profile certbot up -d certbot"
