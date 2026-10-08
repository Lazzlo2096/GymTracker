#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="$("$ROOT/scripts/resolve-java-home.sh")"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$ROOT"
exec npx expo run:android "$@"
