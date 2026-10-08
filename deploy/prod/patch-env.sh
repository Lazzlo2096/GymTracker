#!/usr/bin/env bash
# Дополняет существующий .env.prod недостающими ключами (секреты не перезаписывает).
# Запуск после git pull: ./deploy/prod/patch-env.sh [.env.prod]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=deploy/prod/env.lib.sh
source "${ROOT}/deploy/prod/env.lib.sh"

ENV_FILE="${1:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE. Сначала: ./deploy/prod/generate-env.sh" >&2
  exit 1
fi

_load_env_file "$ENV_FILE"

PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-habitpro.ru}"
CHANGED=0

_patch() {
  if _append_if_missing "$ENV_FILE" "$1" "$2"; then
    CHANGED=1
  fi
}

echo "Проверка $ENV_FILE …"

_patch "ENVIRONMENT" "production"
_patch "PUBLIC_DOMAIN" "$PUBLIC_DOMAIN"
_patch "EXPO_PUBLIC_API_URL" "https://${PUBLIC_DOMAIN}"

_patch "ACCESS_TTL_MINUTES" "15"
_patch "REFRESH_TTL_DAYS" "30"
_patch "COOKIE_SAMESITE" "lax"
_patch "COOKIE_DOMAIN" "$PUBLIC_DOMAIN"
_patch "CORS_ALLOWED_ORIGINS" "https://${PUBLIC_DOMAIN},https://www.${PUBLIC_DOMAIN}"
_patch "CORS_ALLOW_ORIGIN_REGEX" ""

_patch "REDIS_HOST" "redis_container"
_patch "REDIS_PORT" "6379"
_patch "REDIS_GUI_PORT" "5540"
_patch "RI_TRUSTEDORIGINS" "https://${PUBLIC_DOMAIN},https://www.${PUBLIC_DOMAIN}"

_patch "MONITORING_PUBLIC_URL" "https://${PUBLIC_DOMAIN}"
_patch "GRAFANA_ROOT_URL" "https://${PUBLIC_DOMAIN}/grafana/"
_patch "GRAFANA_ADMIN_USER" "admin"

if ! grep -q '^GRAFANA_ADMIN_PASSWORD=' "$ENV_FILE" 2>/dev/null; then
  _patch "GRAFANA_ADMIN_PASSWORD" "$(_rand_pw)"
fi

_patch "CERTBOT_EMAIL" "admin@${PUBLIC_DOMAIN}"
_patch "NGINX_CONF" "./nginx/nginx.prod.bootstrap.conf"
_patch "NGINX_MONITORING_CONF" "./nginx/nginx.prod.monitoring.bootstrap.conf"

if ! grep -q '^PGADMIN_EMAIL=' "$ENV_FILE" 2>/dev/null; then
  _patch "PGADMIN_EMAIL" "admin@${PUBLIC_DOMAIN}"
fi
if ! grep -q '^PGADMIN_PASSWORD=' "$ENV_FILE" 2>/dev/null; then
  _patch "PGADMIN_PASSWORD" "$(_rand_pw)"
fi

if grep -q '^MONITORING_PUBLIC_URL=http://' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^MONITORING_PUBLIC_URL=http://|MONITORING_PUBLIC_URL=https://|" "$ENV_FILE"
  echo "  ~ MONITORING_PUBLIC_URL → https"
  CHANGED=1
fi

if [[ "$CHANGED" -eq 1 ]]; then
  chmod 600 "$ENV_FILE"
  "${ROOT}/deploy/prod/generate-pgbouncer-userlist.sh" "$ENV_FILE" 2>/dev/null || true
  "${ROOT}/deploy/prod/generate-pgadmin-servers.sh" "$ENV_FILE" 2>/dev/null || true
  echo "Готово. Перезапустите: ./deploy/prod/up.sh"
else
  echo "Все обязательные ключи уже есть."
fi
