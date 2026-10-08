#!/usr/bin/env bash
# Expo на физическом устройстве: API = backend на этом ПК (порт 8000).
set -euo pipefail
cd "$(dirname "$0")/.."

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "${IP:-}" ]]; then
  echo "Не удалось определить LAN IP (hostname -I). Задайте вручную:" >&2
  echo "  EXPO_PUBLIC_API_URL=http://<ваш_ip>:8000 npx expo start" >&2
  exit 1
fi

export EXPO_PUBLIC_API_URL="http://${IP}:8000"
echo "→ Backend: $EXPO_PUBLIC_API_URL"
echo "→ Убедитесь: docker compose -f docker-compose.dev.yml up -d (порт 8000)"
exec npx expo start "$@"
