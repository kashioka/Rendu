#!/bin/bash
# Run this twice per release: before merging the release-prep PR, and again
# right before `gh workflow run release.yml`.
#
# release.yml has a Security gate that runs a plain `cargo audit` + `npm audit`
# at dispatch time, so a release can be blocked by an advisory published after
# the prep PR's CI went green (v0.11.1 was stopped three times this way).
# Running the same audits locally first turns that into a fix-before-dispatch.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
status=0

step() { printf '\n== %s\n' "$1"; }

step "1/4 version alignment"
bash "$REPO_ROOT/scripts/check-versions.sh" || status=1

step "2/4 cargo audit"
if command -v cargo-audit >/dev/null 2>&1; then
  (cd "$REPO_ROOT/src-tauri" && cargo audit) || status=1
else
  echo "✗ cargo-audit is not installed (cargo install cargo-audit)" >&2
  status=1
fi

step "3/4 npm audit (high / critical)"
(cd "$REPO_ROOT" && npm audit --audit-level=high) || status=1

step "4/4 published download links"
bash "$REPO_ROOT/scripts/update-download-links.sh" --check || status=1

printf '\n== manual: Apple Developer agreement\n'
echo "Open https://developer.apple.com/account and confirm there is no 'agreement' banner."
echo "An expired agreement fails macOS notarization with HTTP 403 after the build."

if [ "$status" -ne 0 ]; then
  printf '\n✗ preflight failed — fix the items above before merging the prep PR / dispatching release.yml\n' >&2
  exit 1
fi
printf '\n✓ preflight passed\n'
