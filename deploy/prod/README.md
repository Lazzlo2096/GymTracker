# Развёртывание псевдо-prod (Docker)

Псевдо-prod — демо/стейджинг-окружение на одном VPS с Docker Compose. По умолчанию домен **habitpro.ru**; его можно заменить через `PUBLIC_DOMAIN` при генерации `.env.prod`.

Стек: PostgreSQL, **Redis** (кэш GET, rate limit), FastAPI (backend), Expo Web (mobile-web), nginx, pgAdmin, Grafana, Prometheus, Let's Encrypt (certbot).

---

## Требования к серверу

- Linux (Fedora/Ubuntu/Debian), доступ по SSH
- **Docker** и **Docker Compose** v2 (`docker compose`)
- **Git**, **openssl** (для `generate-env.sh`)
- Открыты порты **80** и **443** (Let's Encrypt + HTTPS)
- DNS: **A-запись** `habitpro.ru` и `www.habitpro.ru` → публичный IP сервера (или ваш `PUBLIC_DOMAIN`)

Рекомендуемые ресурсы: от 2 vCPU, 4 GB RAM, 20+ GB диск (образы + БД + медиа).

---

## 1. Клонирование и первый запуск

Все команды — **из корня репозитория**, если не указано иное.

```bash
# На сервере
git clone <URL_репозитория> gymtracker
cd gymtracker

# Вариант A: всё одной командой (первый деплой)
./deploy/prod/bootstrap.sh

# Вариант B: по шагам
./deploy/prod/generate-env.sh          # .env.prod + CREDS + pgAdmin/PgBouncer
# PUBLIC_DOMAIN=demo.example.com ./deploy/prod/generate-env.sh
./deploy/prod/up.sh                    # Redis, Postgres, backend, mobile-web, nginx…

# После git pull (новые переменные в .env, без смены секретов):
./deploy/prod/patch-env.sh
./deploy/prod/up.sh
```

Проверка без HTTPS (bootstrap nginx на :80):

```bash
curl -sI "http://$(grep ^PUBLIC_DOMAIN= .env.prod | cut -d= -f2)/" | head -5
curl -sI "http://$(grep ^PUBLIC_DOMAIN= .env.prod | cut -d= -f2)/api/v1/health" 2>/dev/null || curl -sI "http://127.0.0.1/api/docs" -H "Host: habitpro.ru"
```

Логи:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f --tail=100
```

---

## 2. HTTPS (Let's Encrypt)

После того как DNS указывает на сервер и порт **80** доступен с интернета:

```bash
./deploy/prod/certbot-init.sh
```

Скрипт:

- получает сертификат для `PUBLIC_DOMAIN` и `www.PUBLIC_DOMAIN`;
- переключает `NGINX_CONF` на `./nginx/nginx.prod.conf` и `NGINX_MONITORING_CONF` на `./nginx/nginx.prod.monitoring.conf`;
- выставляет `COOKIE_SECURE=1`;
- перезапускает nginx и backend.

Автообновление сертификата (фоновый контейнер):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile certbot up -d certbot
```

Ручное продление (при необходимости):

```bash
./deploy/prod/certbot-renew.sh
```

---

## 3. Что доступно снаружи

| URL | Назначение |
|-----|------------|
| `https://habitpro.ru/` | Mobile Web (Expo export) |
| `https://habitpro.ru/api/…` | Backend API |
| `https://habitpro.ru/docs` | Swagger (если включён в prod) |
| `https://habitpro.ru/media/…` | Загруженные файлы (аватары, фото залов) |
| `https://habitpro.ru/tools/` | Ссылки на все панели |
| `https://habitpro.ru/pgadmin/` | pgAdmin |
| `https://habitpro.ru/grafana/` | Grafana |
| `https://habitpro.ru/prometheus/` | Prometheus |
| `https://habitpro.ru/redis/` | Redis Insight (кэш API, ключи) |

Логины панелей и пароли БД — в **`deploy/prod/CREDS.generated.txt`** (создаётся `generate-env.sh`). Файл в `.gitignore`, на сервере храните с ограниченными правами (`chmod 600`).

Порт **9000** — редирект на HTTPS (обратная совместимость со старыми ссылками).

---

## 4. Обновление после `git pull`

```bash
cd /path/to/gymtracker
git pull

# Пересборка и перезапуск (миграции при старте backend через db-migrate)
./deploy/prod/up.sh

# Или только отдельные сервисы (build + up -d, без force-recreate):
./deploy/prod/up.sh backend mobile-web nginx
```

Просмотр статуса:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

---

## 5. Полезные команды

```bash
# Остановить стек
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Остановить с удалением томов БД (ОПАСНО — потеря данных)
docker compose -f docker-compose.prod.yml --env-file .env.prod down -v

# Логи одного сервиса
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend

# Пересоздать backend (после смены пароля Postgres в .env.prod)
./deploy/prod/repair-backend.sh

# Дополнить .env.prod недостающими ключами (Redis и т.д.)
./deploy/prod/patch-env.sh

# Перегенерировать pgAdmin / PgBouncer userlist после правки .env.prod
./deploy/prod/generate-pgadmin-servers.sh .env.prod
./deploy/prod/generate-pgbouncer-userlist.sh .env.prod

# Redis Insight поднимается вместе с ./deploy/prod/up.sh
# Открыть: https://<PUBLIC_DOMAIN>/redis/  или  http://localhost:5540  (с VPS)

# Grafana не открывается — сброс пароля/конфига (см. скрипт)
./deploy/prod/fix-grafana.sh

# Полная очистка данных (осторожно)
./deploy/prod/wipe-data.sh
```

Переменная для нестандартного env-файла:

```bash
ENV_FILE=/etc/gymtracker/.env.prod ./deploy/prod/up.sh
```

---

## 6. Файлы конфигурации

| Файл | Описание |
|------|----------|
| `.env.prod` | Секреты и переменные (генерируется, **не коммитить**) |
| `deploy/prod/.env.prod.example` | Шаблон полей |
| `deploy/prod/CREDS.generated.txt` | Пароли для человека (генерируется) |
| `deploy/prod/generate-env.sh` | Создать `.env.prod` (`--force` для перезаписи с бэкапом) |
| `deploy/prod/patch-env.sh` | Добавить недостающие ключи без смены секретов |
| `deploy/prod/bootstrap.sh` | `generate-env` + `up` |
| `deploy/prod/up-tools.sh` | Redis Insight (profile `tools`) |
| `docker-compose.prod.yml` | Описание сервисов |
| `nginx/nginx.prod.bootstrap.conf` | HTTP до certbot |
| `nginx/nginx.prod.monitoring.bootstrap.conf` | Порт 9000 без TLS до certbot |
| `nginx/nginx.prod.conf` | HTTPS после certbot |

Опционально в `.env.prod`: OAuth (`GOOGLE_OAUTH_*`, `VK_OAUTH_*`), YooKassa — см. комментарии в `.env.prod.example`.

---

## 7. Сборка APK под псевдо-prod

На машине разработчика (не на сервере), API уже указывает на `https://habitpro.ru` в `mobile/eas.json`:

```bash
cd mobile
npm install
npx eas-cli login
./scripts/build-habitpro-android.sh apk
```

Подробнее: `mobile/README.md`.

---

## 8. Краткая шпаргалка (первый деплой)

```bash
git clone <URL> gymtracker && cd gymtracker
./deploy/prod/bootstrap.sh
./deploy/prod/certbot-init.sh
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile certbot up -d certbot
```

Проверка: открыть `https://habitpro.ru/`, зарегистрироваться, убедиться что запросы идут на `https://habitpro.ru/api/…`.

---

## Безопасность

- Не коммитьте `.env.prod` и `CREDS.generated.txt`.
- Postgres **не** публикуется наружу — только внутри Docker-сети.
- Панели (`/pgadmin/`, `/grafana/`) доступны по HTTPS; ограничьте доступ файрволом или VPN при необходимости.
- После утечки `CREDS.generated.txt` — смените пароли, пересоздайте `.env.prod` и перезапустите стек.
