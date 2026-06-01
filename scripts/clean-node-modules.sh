#!/usr/bin/env bash
# Remove a broken or partial node_modules (common after Ctrl+C during koffi build).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "▶ Stopping NeuroVis processes that may lock node_modules…"
bash "$ROOT_DIR/scripts/neurovis-stop.sh" >/dev/null 2>&1 || true

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "✓ node_modules already absent."
  exit 0
fi

chmod -R u+w "$ROOT_DIR/node_modules" 2>/dev/null || true

echo "▶ Removing node_modules…"
for attempt in 1 2 3; do
  if rm -rf "$ROOT_DIR/node_modules" 2>/dev/null; then
    break
  fi
  echo "   retry $attempt/3 (ENOTEMPTY — waiting 2s)…"
  sleep 2
  chmod -R u+w "$ROOT_DIR/node_modules" 2>/dev/null || true
done

if [ -d "$ROOT_DIR/node_modules" ]; then
  echo "✗ Could not remove node_modules. Close Terminal tabs running npm/NeuroVis, then run:"
  echo "   chmod -R u+w node_modules && rm -rf node_modules"
  exit 1
fi

echo "✓ node_modules removed."
