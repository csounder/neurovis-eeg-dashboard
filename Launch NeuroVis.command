#!/usr/bin/env bash
# NeuroVis one-click launcher.
#
# Double-click this file in Finder to:
#   1. Stop any stale NeuroVis processes on ports 3000 / 8080 / 3001.
#   2. Start the Node bridge (server-enhanced.js  →  HTTP :3000  +  WebSocket :8080).
#   3. Start the Next.js frontend (web/  →  http://localhost:3001).
#   4. Wait until the frontend responds, then open it in your default browser.
#
# Press Ctrl+C in this Terminal window to stop both servers cleanly.
#
# To open at a specific page on launch, edit OPEN_PATH below (e.g. "/research").

set -u

OPEN_PATH="${NEUROVIS_OPEN_PATH:-/}"
WEB_URL="http://localhost:3001${OPEN_PATH}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

CYAN='\033[36m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; DIM='\033[2m'; RESET='\033[0m'
banner() { printf "${CYAN}▶${RESET} %s\n" "$1"; }
ok()     { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()   { printf "${YELLOW}!${RESET} %s\n" "$1"; }
err()    { printf "${RED}✗${RESET} %s\n" "$1" >&2; }

trap 'on_exit' EXIT INT TERM

BRIDGE_PID=""
WEB_PID=""
on_exit() {
  echo
  banner "Shutting down NeuroVis…"
  [ -n "$BRIDGE_PID" ] && kill "$BRIDGE_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ]    && kill "$WEB_PID"    2>/dev/null || true
  # Best-effort cleanup of anything still bound.
  bash "$ROOT_DIR/scripts/neurovis-stop.sh" >/dev/null 2>&1 || true
  ok "Stopped. Window can be closed."
}

clear
printf "${CYAN}┌──────────────────────────────────────────────┐\n"
printf "│            NeuroVis launcher                  │\n"
printf "│   Node bridge :3000 · WebSocket :8080         │\n"
printf "│   Next.js frontend :3001                      │\n"
printf "└──────────────────────────────────────────────┘${RESET}\n\n"

# ---- 0. Prereqs ----
if ! command -v node >/dev/null 2>&1; then
  err "Node.js not found in PATH. Install Node 20+ from https://nodejs.org and try again."
  read -n 1 -s -r -p "Press any key to close…"; exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  err "npm not found in PATH."
  read -n 1 -s -r -p "Press any key to close…"; exit 1
fi
banner "Node $(node -v) · npm $(npm -v)"

# ---- 1. Stop stale processes ----
banner "Releasing ports 3000 / 8080 / 3001 if anything is bound…"
bash "$ROOT_DIR/scripts/neurovis-stop.sh" >/dev/null 2>&1 || true

# ---- 2. Install deps if missing ----
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  banner "Installing root dependencies (one-time)…"
  npm install --silent || { err "Root npm install failed."; read -n 1 -s -r -p "Press any key to close…"; exit 1; }
fi
if [ ! -d "$ROOT_DIR/web/node_modules" ]; then
  banner "Installing web/ dependencies (one-time)…"
  (cd "$ROOT_DIR/web" && npm install --silent) || { err "web/ npm install failed."; read -n 1 -s -r -p "Press any key to close…"; exit 1; }
fi

mkdir -p "$ROOT_DIR/.launcher-logs"
BRIDGE_LOG="$ROOT_DIR/.launcher-logs/bridge.log"
WEB_LOG="$ROOT_DIR/.launcher-logs/web.log"
: > "$BRIDGE_LOG"
: > "$WEB_LOG"

# ---- 3. Start the Node bridge ----
banner "Starting Node bridge (server-enhanced.js)…"
( npm start ) >>"$BRIDGE_LOG" 2>&1 &
BRIDGE_PID=$!
printf "${DIM}   pid=%s · log=%s${RESET}\n" "$BRIDGE_PID" "$BRIDGE_LOG"

# ---- 4. Start the Next.js frontend ----
banner "Starting Next.js frontend (web/)…"
( cd "$ROOT_DIR/web" && npm run dev ) >>"$WEB_LOG" 2>&1 &
WEB_PID=$!
printf "${DIM}   pid=%s · log=%s${RESET}\n" "$WEB_PID" "$WEB_LOG"

# ---- 5. Wait for the frontend, then open the browser ----
banner "Waiting for http://127.0.0.1:3001 to respond…"
deadline=$(( $(date +%s) + 120 ))
ready=0
dots=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  code=$(curl -4 -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:3001/" 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "304" ]; then
    ready=1
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    err "Frontend process exited early. Last lines from web log:"
    tail -n 30 "$WEB_LOG" || true
    exit 1
  fi
  dots=$((dots + 1))
  if [ $((dots % 5)) -eq 0 ]; then
    printf "${DIM}   …still waiting (last HTTP %s)${RESET}\n" "$code"
  fi
  sleep 1
done

if [ "$ready" -eq 1 ]; then
  ok "NeuroVis is up. Opening $WEB_URL"
  open "$WEB_URL" 2>/dev/null || warn "Could not auto-open browser. Visit $WEB_URL manually."
else
  err "Frontend did not return HTTP 200 within 120s (last log lines):"
  tail -n 40 "$WEB_LOG" || true
  exit 1
fi

cat <<EOF

${GREEN}NeuroVis is running.${RESET}

  Frontend  : http://localhost:3001${OPEN_PATH}
  Backend   : http://localhost:3000  (REST)
  WebSocket : ws://localhost:8080

  Live logs : tail -f "$BRIDGE_LOG" "$WEB_LOG"

  Press ${YELLOW}Ctrl+C${RESET} in this window to stop both servers.

EOF

# Stream both logs side-by-side so the launcher window is informative.
tail -n 0 -F "$BRIDGE_LOG" "$WEB_LOG" &
TAIL_PID=$!
trap 'kill $TAIL_PID 2>/dev/null || true; on_exit' EXIT INT TERM
wait "$WEB_PID" "$BRIDGE_PID"
