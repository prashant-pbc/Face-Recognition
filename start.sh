#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv"
export PYTHONUNBUFFERED=1

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi

"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install -r "$BACKEND/requirements.txt"
"$VENV/bin/python" "$BACKEND/download_models.py" || true

if [ ! -d "$FRONTEND/node_modules" ]; then
  (cd "$FRONTEND" && npm install)
fi

(cd "$BACKEND" && "$VENV/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACK_PID=$!

cd "$FRONTEND"
npm run dev

kill "$BACK_PID" 2>/dev/null || true
