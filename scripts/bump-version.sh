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

# macOS only — `sed -i ''` below is BSD-specific. If you need to run this
# elsewhere, replace the sed calls with a portable alternative (perl -pi -e).
if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: bump-version.sh requires BSD sed (macOS only). Run on macOS or switch to a portable rewriter." >&2
  exit 1
fi

# 1. package.json
# Anchor on `^  "version"` so dependency version strings (which live at
# deeper indents and don't follow that exact key) are untouched.
sed -i '' -E "s/^(  \"version\": \")[^\"]*(\")/\1$VERSION\2/" "$REPO_ROOT/package.json"

# 2. tauri.conf.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$REPO_ROOT/src-tauri/tauri.conf.json"

# 3. Cargo.toml
sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" "$REPO_ROOT/src-tauri/Cargo.toml"

# 4. Re-resolve lockfiles so name/version fields propagate. Both calls
# are required: npm refreshes package-lock.json, cargo refreshes
# Cargo.lock. We intentionally let errors surface — a silent lockfile
# regen failure would leave a stale lockfile alongside the bumped
# manifests, which is exactly the drift this script is meant to prevent.
(cd "$REPO_ROOT" && npm install --package-lock-only --silent)
(cd "$REPO_ROOT/src-tauri" && cargo generate-lockfile)

echo "Bumped to v$VERSION:"
echo "  - package.json"
echo "  - package-lock.json"
echo "  - src-tauri/tauri.conf.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/Cargo.lock"
echo ""
echo "Verifying alignment..."
bash "$REPO_ROOT/scripts/check-versions.sh"
