#!/usr/bin/env bash
# Create NeuroVis/.venv and install bleak (Athena BLE). Use when system Python
# is PEP 668 / "externally managed" and `pip install bleak` is blocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -r requirements-athena.txt
echo ""
echo "Done. bleak is in $ROOT/.venv"
echo "Restart the server:  npm run start:athena"
echo "(Optional: export ATHENA_PYTHON=\"$ROOT/.venv/bin/python3\")"
