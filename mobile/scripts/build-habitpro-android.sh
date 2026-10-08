#!/usr/bin/env bash
# TGL-7: черновые APK и AAB для habitpro.ru (EAS Build).
#
# Требуется: npx eas-cli login, аккаунт Expo (projectId в app.json).
# JDK 17/21 — для --local (опционально).
#
# Использование:
#   ./scripts/build-habitpro-android.sh           # облако: APK + AAB
#   ./scripts/build-habitpro-android.sh apk       # только APK
#   ./scripts/build-habitpro-android.sh aab       # только AAB
#   ./scripts/build-habitpro-android.sh apk local # APK локально (нужен Android SDK)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="$("$ROOT/scripts/resolve-java-home.sh")"
export PATH="$JAVA_HOME/bin:$PATH"

if [[ -z "${ANDROID_HOME:-}" && -d "$HOME/Android/Sdk" ]]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
fi

EAS=(npx eas-cli)
TARGET="${1:-all}"
MODE="${2:-cloud}"

echo "API: https://habitpro.ru (EXPO_PUBLIC_API_URL в профилях habitpro-apk / habitpro-aab)"
"${EAS[@]}" whoami

build_one() {
  local profile="$1"
  local local_flag=()
  if [[ "$MODE" == "local" ]]; then
    local_flag=(--local)
    echo "Локальная сборка ($profile)…"
  else
    echo "Облачная сборка EAS ($profile)…"
  fi
  "${EAS[@]}" build --platform android --profile "$profile" --non-interactive "${local_flag[@]}" "$@"
}

mkdir -p "$ROOT/builds"

case "$TARGET" in
  apk)
    build_one habitpro-apk
  ;;
  aab)
    build_one habitpro-aab
  ;;
  all|*)
    build_one habitpro-apk
    build_one habitpro-aab
  ;;
esac

echo ""
echo "Скачать артефакты:"
echo "  npx eas-cli build:list --platform android --limit 5"
echo "  npx eas-cli build:download --latest --platform android"
echo ""
echo "Установка APK на телефон (USB + отладка по USB):"
echo "  adb install -r builds/*.apk   # или путь из build:download"
