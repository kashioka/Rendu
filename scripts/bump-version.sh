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

# 4. Propagate the version into both lockfiles. Errors are left to surface —
# a silent lockfile failure would leave a stale lockfile alongside the bumped
# manifests, which is exactly the drift this script is meant to prevent.
#
# package-lock.json: rewrite only the root `version` and `packages[""].version`
# instead of `npm install --package-lock-only`. A version bump needs no
# re-resolution, and npm 10.9.x drops the `libc` field from the optional
# `@tailwindcss/oxide-linux-*` entries when it rewrites the lockfile (hit at
# v0.11.3; the prep PR had to restore the lockfile by hand).
#
# `cargo update --workspace` updates ONLY the local package's version
# entry in Cargo.lock, leaving every external dependency pinned. We must
# NOT use `cargo generate-lockfile` here: it re-resolves the entire
# graph, which silently minor-bumps the `tauri` crate (Cargo.toml pins it
# with an implicit caret, e.g. 2.10.3 → 2.11.x). That desyncs the Rust
# `tauri` crate from the JS `@tauri-apps/*` packages, and tauri-action
# fails every release build on the mismatch (hit during v0.7.1).
VERSION="$VERSION" LOCK="$REPO_ROOT/package-lock.json" node -e '
const fs = require("fs");
const { VERSION, LOCK } = process.env;
const lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
if (!lock.packages || !lock.packages[""]) {
  console.error("package-lock.json has no packages[\"\"] entry");
  process.exit(1);
}
lock.version = VERSION;
lock.packages[""].version = VERSION;
fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
'
(cd "$REPO_ROOT/src-tauri" && cargo update --workspace)

echo "Bumped to v$VERSION:"
echo "  - package.json"
echo "  - package-lock.json"
echo "  - src-tauri/tauri.conf.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/Cargo.lock"
echo ""
echo "Verifying alignment..."
bash "$REPO_ROOT/scripts/check-versions.sh"
