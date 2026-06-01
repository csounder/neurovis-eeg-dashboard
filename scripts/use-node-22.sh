#!/usr/bin/env bash
# Put Homebrew Node 22 first on PATH (works without nvm).
# Safe to source from Launch NeuroVis.command — must not "exit" when sourced.

_set_node22_path() {
  for dir in /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin; do
    if [ -x "$dir/node" ]; then
      export PATH="$dir:$PATH"
      echo "Using Node $(node -v) from $dir"
      return 0
    fi
  done
  echo "✗ Node 22 not found on PATH." >&2
  echo "" >&2
  echo "Install with Homebrew (no nvm required):" >&2
  echo "  brew install node@22" >&2
  echo "  export PATH=\"/opt/homebrew/opt/node@22/bin:\$PATH\"" >&2
  return 1
}

# Run directly: exit with status. Source: return only (do not kill parent shell).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  set -euo pipefail
  _set_node22_path
else
  _set_node22_path || true
fi
