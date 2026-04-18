#!/bin/bash
# Usage: ./scripts/bump-version.sh 0.5.4
set -euo pipefail

VERSION="${1:?Usage: $0 <version>}"

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: Invalid version format: $VERSION" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. tauri.conf.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$REPO_ROOT/src-tauri/tauri.conf.json"

# 2. Cargo.toml
sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" "$REPO_ROOT/src-tauri/Cargo.toml"

# 3. Update Cargo.lock
(cd "$REPO_ROOT/src-tauri" && cargo generate-lockfile 2>/dev/null || true)

echo "Bumped to v$VERSION:"
echo "  - src-tauri/tauri.conf.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/Cargo.lock"
