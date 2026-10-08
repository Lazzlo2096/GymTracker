#!/usr/bin/env bash
# Gradle для Android (Expo/RN) нужен JDK 17 или 21. Java 25 даёт:
# Unsupported class file major version 69

set -euo pipefail

is_supported_java() {
  local java_bin="$1/bin/java"
  [[ -x "$java_bin" ]] || return 1
  local ver
  ver="$("$java_bin" -version 2>&1 | head -n1)"
  [[ "$ver" =~ version\ \"(1\.)?17\. ]] && return 0
  [[ "$ver" =~ version\ \"(1\.)?21\. ]] && return 0
  return 1
}

candidates=(
  "${JAVA_HOME:-}"
  /usr/lib/jvm/java-21-openjdk
  /usr/lib/jvm/java-17-openjdk
  /usr/lib/jvm/java-21
  /usr/lib/jvm/java-17
  "$HOME/.sdkman/candidates/java/21.0.11-tem"
  "$HOME/.sdkman/candidates/java/17.0.13-tem"
)

for home in "${candidates[@]}"; do
  [[ -n "$home" ]] || continue
  if is_supported_java "$home"; then
    printf '%s\n' "$home"
    exit 0
  fi
done

echo "Не найден JDK 17 или 21. Сейчас в PATH:" >&2
java -version >&2 || true
echo >&2
echo "Fedora: sudo dnf install -y java-21-openjdk-devel" >&2
echo "Затем: export JAVA_HOME=/usr/lib/jvm/java-21-openjdk" >&2
exit 1
