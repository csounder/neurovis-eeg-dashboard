#!/usr/bin/env bash
# Production root install for NeuroVis.
# Full install includes brainflow → koffi native compile (5–15 min, Node 20–22 only).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CORE_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --core) CORE_ONLY=1 ;;
  esac
done

# Prefer Homebrew Node 22 when present (user may still have Node 25 as default).
if [ -x /opt/homebrew/opt/node@22/bin/node ] || [ -x /usr/local/opt/node@22/bin/node ]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/scripts/use-node-22.sh"
fi

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
node_ver="$(node -v)"

if [ "$CORE_ONLY" -eq 0 ] && [ "$node_major" -ge 25 ]; then
  echo "✗ Node $node_ver cannot build brainflow/koffi reliably (NeuroVis requires Node 20–22 for OpenBCI)."
  echo ""
  echo "Fix (Homebrew — you do not need nvm):"
  echo "  brew install node@22"
  echo "  export PATH=\"/opt/homebrew/opt/node@22/bin:\$PATH\""
  echo "  node -v    # should show v22.x"
  echo "  npm run clean:node"
  echo "  npm run install:root"
  echo ""
  echo "Muse + NIME Csound only (no OpenBCI Ganglion/Cyton) on this Node version:"
  echo "  npm run clean:node && npm run install:core"
  exit 1
fi

if [ -d "$ROOT_DIR/node_modules/koffi" ] && [ ! -f "$ROOT_DIR/node_modules/brainflow/package.json" ]; then
  echo "▶ Interrupted koffi build detected — cleaning…"
  bash "$ROOT_DIR/scripts/clean-node-modules.sh"
fi

npm_flags=(--omit=dev --no-fund --no-audit)
if [ "$CORE_ONLY" -eq 1 ]; then
  echo "▶ Core install (no brainflow / OpenBCI)…"
  npm_flags+=(--no-optional)
else
  echo "▶ Full install (brainflow → koffi native build on $node_ver)…"
  echo "   This often takes 5–15 minutes with little output. Do not press Ctrl+C."
fi
echo "   Skipping Electron/Playwright devDependencies."
echo "   (npm may look idle for several minutes while koffi compiles — still working.)"
echo ""

if ! npm install "${npm_flags[@]}" --loglevel=warn --progress=true; then
  echo ""
  echo "✗ npm install failed. If you saw SIGINT, you interrupted the koffi compile."
  echo "  Run: npm run clean:node && npm run install:root"
  exit 1
fi

if [ "$CORE_ONLY" -eq 1 ]; then
  echo "✓ Core dependencies ready (Muse bridge + OSC; OpenBCI needs: npm run install:root on Node 22)."
  exit 0
fi

if [ ! -f "$ROOT_DIR/node_modules/brainflow/package.json" ]; then
  echo "✗ brainflow missing after install."
  exit 1
fi

echo "✓ Root dependencies ready (brainflow installed)."
