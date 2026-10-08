# Общие функции для deploy/prod/*.sh (подключать: source deploy/prod/env.lib.sh)

_env_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

_load_env_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Нет файла $file" >&2
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

_append_if_missing() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  if ! grep -q "^${key}=" "$env_file" 2>/dev/null; then
    echo "${key}=${value}" >>"$env_file"
    echo "  + ${key}"
    return 0
  fi
  return 1
}

_rand_hex() {
  openssl rand -hex 32
}

_rand_pw() {
  openssl rand -base64 36 | tr -d '/+=' | head -c 32
}
