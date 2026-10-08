#!/usr/bin/env bash
# Совместимость: дополняет .env.prod (мониторинг + Redis и прочие ключи).
# Предпочтительно: ./deploy/prod/patch-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec "${ROOT}/deploy/prod/patch-env.sh" "${1:-.env.prod}"
