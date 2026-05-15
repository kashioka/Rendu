#!/bin/bash
# Verify that the project version is the same across all manifest files.
#
# This guards against the drift seen with v0.6.1 — package.json sat at
# 0.5.2 for ~25 days while tauri.conf.json and Cargo.toml advanced to
# 0.6.1, because the original bump-version.sh never touched package.json.
# CI runs this on every PR so the mismatch fails fast.
#
# Usage: bash scripts/check-versions.sh
# Exit 0 if aligned, 1 otherwise.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Pass paths via argv so a single-quote in REPO_ROOT (e.g.
# `/Users/o'brien/...`) doesn't break the node interpolation.
PKG=$(node -p "require(process.argv[1]).version" "$REPO_ROOT/package.json")
CONF=$(node -p "require(process.argv[1]).version" "$REPO_ROOT/src-tauri/tauri.conf.json")
CARGO=$(awk -F'"' '/^version = /{print $2; exit}' "$REPO_ROOT/src-tauri/Cargo.toml")

if [ "$PKG" = "$CONF" ] && [ "$CONF" = "$CARGO" ]; then
  echo "✓ version aligned: $PKG"
  exit 0
fi

echo "✗ version mismatch:" >&2
echo "    package.json:               $PKG" >&2
echo "    src-tauri/tauri.conf.json:  $CONF" >&2
echo "    src-tauri/Cargo.toml:       $CARGO" >&2
echo "" >&2
echo "Fix: run 'bash scripts/bump-version.sh <version>' to align all files." >&2
exit 1
