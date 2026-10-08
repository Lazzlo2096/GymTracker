#!/usr/bin/env bash
# Деплой prod с Bitbucket Pipelines (pipe atlassian/ssh-run).
#
# Локально на сервере:
#   ./deploy/prod/pipeline-deploy.sh
#
# Из pipeline (MODE: command, путь на prod VPS):
#   bash /root/repos/gymtracker/deploy/prod/pipeline-deploy.sh
#
# Переменные (опционально):
#   DEPLOY_BRANCH=prod_server
#   ENV_FILE=.env.prod
#   DEPLOY_LOCK_FILE=/tmp/gymtracker-prod-deploy.lock

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEPLOY_BRANCH="${DEPLOY_BRANCH:-prod_server}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/gymtracker-prod-deploy.lock}"
ENV_FILE="${ENV_FILE:-.env.prod}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Другой деплой уже выполняется ($LOCK_FILE)." >&2
  exit 1
fi

echo "==> GymTracker prod deploy"
echo "    Repo:   $ROOT"
echo "    Branch: $DEPLOY_BRANCH"
echo "    Env:    $ENV_FILE"

git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git pull origin "$DEPLOY_BRANCH"

./deploy/prod/patch-env.sh "$ENV_FILE"
./deploy/prod/up.sh

echo "==> Deploy finished."
