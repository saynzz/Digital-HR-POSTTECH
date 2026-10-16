#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

red() { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }

PY=""
for p in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$p" >/dev/null 2>&1; then
    v=$("$p" -c 'import sys; print(sys.version_info[0]*100+sys.version_info[1])')
    if [ "$v" -ge 310 ] && [ "$v" -le 313 ]; then PY="$p"; break; fi
  fi
done
if [ -z "$PY" ]; then
  red "Нужен Python 3.10–3.13. Установите: brew install python@3.13"
  red "(или скачайте установщик 3.13 с python.org) и запустите скрипт снова."
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  red "Нужен Node.js 18 или новее. Установите: brew install node"
  red "(или скачайте LTS-установщик с nodejs.org) и запустите скрипт снова."
  exit 1
fi

green "Python: $($PY --version), Node: $(node --version)"

cd "$ROOT/backend"
if [ ! -d .venv ]; then
  green "Создаю окружение Python (один раз)…"
  "$PY" -m venv .venv
fi
grep -v '^psycopg' requirements.txt > .venv/requirements-local.txt
.venv/bin/pip install -q --disable-pip-version-check -r .venv/requirements-local.txt

cd "$ROOT/frontend"
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  green "Ставлю зависимости фронта (один раз, ~1 мин)…"
  npm install --no-audit --no-fund
fi

cd "$ROOT/backend"
LLM_PROVIDER=none .venv/bin/uvicorn app.main:app --port 8000 &
BACK=$!
trap 'kill $BACK 2>/dev/null; exit 0' INT TERM EXIT

cd "$ROOT/frontend"
green ""
green "Открывайте http://localhost:5173  (вход: employee@jana.demo / demo123)"
green "Остановить: Ctrl+C"
green ""
npm run dev -- --port 5173 --strictPort
