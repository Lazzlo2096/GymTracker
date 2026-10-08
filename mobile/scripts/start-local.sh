#!/usr/bin/env bash
# Локальный Expo: API http://127.0.0.1:8000 (web / симулятор на этом ПК).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:8000}"
echo "→ Backend (host): $EXPO_PUBLIC_API_URL"
echo "→ Android-эмулятор: http://10.0.2.2:${EXPO_PUBLIC_API_URL##*:} (или npm run start:android-emulator)"
exec npx expo start "$@"
