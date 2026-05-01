#!/usr/bin/env bash
# Build MuseBridge from swift-bridge/MuseBridgeApp and install to repo root ./MuseBridge
# (used by server-enhanced.js / BRIDGE_PATH default).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJ_DIR="$REPO_ROOT/swift-bridge/MuseBridgeApp/MuseBridge"
DERIVED="$PROJ_DIR/XcodeDerivedData"
CONFIG="${1:-Release}"

if [[ ! -d "$PROJ_DIR/MuseBridge.xcodeproj" ]]; then
  echo "error: expected $PROJ_DIR/MuseBridge.xcodeproj" >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/Muse.framework" ]]; then
  echo "error: Muse.framework not found at $REPO_ROOT/Muse.framework — cannot link." >&2
  exit 1
fi

echo "Building MuseBridge ($CONFIG)…"
(
  cd "$PROJ_DIR"
  xcodebuild \
    -project MuseBridge.xcodeproj \
    -scheme MuseBridge \
    -configuration "$CONFIG" \
    -derivedDataPath "$DERIVED" \
    build
)

BIN="$DERIVED/Build/Products/$CONFIG/MuseBridge"
if [[ ! -f "$BIN" ]]; then
  echo "error: binary not found at $BIN" >&2
  exit 1
fi

cp -f "$BIN" "$REPO_ROOT/MuseBridge"
chmod +x "$REPO_ROOT/MuseBridge"
echo "Installed: $REPO_ROOT/MuseBridge"
file "$REPO_ROOT/MuseBridge"
ls -la "$REPO_ROOT/MuseBridge"
