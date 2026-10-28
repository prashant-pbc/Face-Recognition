#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONUNBUFFERED=1

cd "$ROOT/backend"
python3 download_models.py
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACK_PID=$!

cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  npm install
fi
npm run dev

kill "$BACK_PID" 2>/dev/null || true
