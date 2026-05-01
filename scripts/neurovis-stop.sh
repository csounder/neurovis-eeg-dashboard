#!/usr/bin/env bash
# Stop NeuroVis dev processes: Node backend (3000/8080) and Next.js (3001).
set -euo pipefail

for port in 3000 3001 8080; do
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "${pids:-}" ]; then
    echo "Stopping listener(s) on port $port: $pids"
    kill $pids 2>/dev/null || true
  fi
done

sleep 0.3

# Second pass (anything still bound)
for port in 3000 3001 8080; do
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "${pids:-}" ]; then
    echo "Force stop on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "Done. Ports 3000, 3001, 8080 should be free (check: lsof -nP -iTCP:3000 -sTCP:LISTEN)."
