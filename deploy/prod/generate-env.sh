#!/usr/bin/env bash
# Генерирует .env.prod и deploy/prod/CREDS.generated.txt со случайными секретами.
#
# Использование (из корня репозитория):
#   ./deploy/prod/generate-env.sh
#   PUBLIC_DOMAIN=demo.example.com ./deploy/prod/generate-env.sh
#   ./deploy/prod/generate-env.sh --force          # перезапись с бэкапом
#   ./deploy/prod/generate-env.sh --force /path/.env.prod

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=deploy/prod/env.lib.sh
source "${ROOT}/deploy/prod/env.lib.sh"

FORCE=0
ENV_FILE=".env.prod"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f)
      FORCE=1
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--force] [.env.prod]"
      exit 0
      ;;
    *)
      ENV_FILE="$1"
      shift
      ;;
  esac
done

CREDS_FILE="deploy/prod/CREDS.generated.txt"

if [[ -f "$ENV_FILE" ]]; then
  if [[ "$FORCE" -ne 1 ]]; then
    echo "Файл $ENV_FILE уже существует." >&2
    echo "  Удалите его, укажите другой путь или: $0 --force" >&2
    exit 1
  fi
  BACKUP="${ENV_FILE}.bak.$(date +%s)"
  cp "$ENV_FILE" "$BACKUP"
  echo "Бэкап: $BACKUP"
fi

POSTGRES_USER="gymtracker"
POSTGRES_PASSWORD="$(_rand_pw)"
POSTGRES_DB="gymtracker"
AUTH_SECRET="$(_rand_hex)"
PGADMIN_EMAIL="${PGADMIN_EMAIL:-admin@habitpro.ru}"
PGADMIN_PASSWORD="$(_rand_pw)"
GRAFANA_ADMIN_USER="${GRAFANA_ADMIN_USER:-admin}"
GRAFANA_ADMIN_PASSWORD="$(_rand_pw)"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-habitpro.ru}"
MONITORING_PUBLIC_URL="https://${PUBLIC_DOMAIN}"
GRAFANA_ROOT_URL="https://${PUBLIC_DOMAIN}/grafana/"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${PUBLIC_DOMAIN}}"
EXPO_PUBLIC_API_URL="https://${PUBLIC_DOMAIN}"

cat >"$ENV_FILE" <<EOF
# Сгенерировано $(date -Iseconds) — не коммитить
ENVIRONMENT=production

PUBLIC_DOMAIN=${PUBLIC_DOMAIN}
EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

AUTH_SECRET=${AUTH_SECRET}
ACCESS_TTL_MINUTES=15
REFRESH_TTL_DAYS=30

# До certbot-init: 0; после HTTPS certbot-init выставит 1
COOKIE_SECURE=0
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=${PUBLIC_DOMAIN}

CORS_ALLOWED_ORIGINS=https://${PUBLIC_DOMAIN},https://www.${PUBLIC_DOMAIN}
CORS_ALLOW_ORIGIN_REGEX=

# Redis обязателен (сервис redis_container в docker-compose.prod.yml)
REDIS_HOST=redis_container
REDIS_PORT=6379
REDIS_GUI_PORT=5540
RI_TRUSTEDORIGINS=https://${PUBLIC_DOMAIN},https://www.${PUBLIC_DOMAIN}

PGADMIN_EMAIL=${PGADMIN_EMAIL}
PGADMIN_PASSWORD=${PGADMIN_PASSWORD}

GRAFANA_ADMIN_USER=${GRAFANA_ADMIN_USER}
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
MONITORING_PUBLIC_URL=${MONITORING_PUBLIC_URL}
GRAFANA_ROOT_URL=${GRAFANA_ROOT_URL}

CERTBOT_EMAIL=${CERTBOT_EMAIL}

# nginx: bootstrap до HTTPS, затем ./nginx/nginx.prod.conf (certbot-init.sh)
NGINX_CONF=./nginx/nginx.prod.bootstrap.conf
NGINX_MONITORING_CONF=./nginx/nginx.prod.monitoring.bootstrap.conf

# OAuth / YooKassa (раскомментируйте при необходимости)
# GOOGLE_OAUTH_CLIENT_ID=
# GOOGLE_OAUTH_CLIENT_SECRET=
# GOOGLE_OAUTH_DEFAULT_REDIRECT_URI=https://${PUBLIC_DOMAIN}/api/v1/auth/oauth/google/callback
# VK_OAUTH_CLIENT_ID=
# VK_OAUTH_CLIENT_SECRET=
# YOOKASSA_SHOP_ID=
# YOOKASSA_SECRET_KEY=
EOF

chmod 600 "$ENV_FILE"

cat >"$CREDS_FILE" <<EOF
# GymTracker псевдо-prod — учётные данные ($(date -Iseconds))
# Храните локально, не коммитьте. При утечке — смените пароли и пересоздайте .env.prod

Домен:              ${PUBLIC_DOMAIN}
Mobile / API URL:     ${EXPO_PUBLIC_API_URL}

PostgreSQL:
  user:     ${POSTGRES_USER}
  password: ${POSTGRES_PASSWORD}
  database: ${POSTGRES_DB}
  (внутри docker: host=postgres, port=5432)

Redis (обязателен для backend):
  host:     redis_container:6379 (внутри docker-сети)
  GUI:      \${MONITORING_PUBLIC_URL}/redis/  (или localhost:\${REDIS_GUI_PORT:-5540}/redis/)

Панели (${MONITORING_PUBLIC_URL}/tools/):
  pgAdmin:    ${PGADMIN_EMAIL} / ${PGADMIN_PASSWORD}
  Grafana:    ${GRAFANA_ADMIN_USER} / ${GRAFANA_ADMIN_PASSWORD}
  Prometheus: ${MONITORING_PUBLIC_URL}/prometheus/

AUTH_SECRET (мин. 32 символа): ${AUTH_SECRET}

Certbot email: ${CERTBOT_EMAIL}

Деплой:
  ./deploy/prod/up.sh
  ./deploy/prod/certbot-init.sh
EOF

chmod 600 "$CREDS_FILE"

"${ROOT}/deploy/prod/generate-pgbouncer-userlist.sh" "$ENV_FILE"
"${ROOT}/deploy/prod/generate-pgadmin-servers.sh" "$ENV_FILE"

echo ""
echo "Создано: $ENV_FILE"
echo "Учётные данные: $CREDS_FILE"
echo "PgBouncer: pgbouncer/userlist.prod.txt"
echo "pgAdmin:   docker/pgadmin/servers.prod.json"
echo ""
echo "Дальше: ./deploy/prod/up.sh"
