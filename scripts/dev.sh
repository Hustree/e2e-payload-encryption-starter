#!/usr/bin/env bash
# Runs backend (Quarkus :8080) and frontend (React :3000) concurrently.
# Ctrl-C stops both.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

cleanup() {
  echo ""
  echo "[dev.sh] shutting down..."
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "[dev.sh] installing frontend deps..."
  (cd "$FRONTEND_DIR" && npm install)
fi

echo "[dev.sh] starting backend on :8080 ..."
(cd "$BACKEND_DIR" && ./mvnw quarkus:dev) &
BACKEND_PID=$!

echo "[dev.sh] starting frontend on :3000 ..."
(cd "$FRONTEND_DIR" && npm start) &
FRONTEND_PID=$!

echo ""
echo "[dev.sh] ready:"
echo "  backend  http://localhost:8080"
echo "  frontend http://localhost:3000"
echo "  jwks     http://localhost:8080/.well-known/jwks.json"
echo "  (Ctrl-C to stop both)"
echo ""

wait
