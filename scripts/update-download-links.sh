#!/bin/bash
# Rewrite the user-facing download links (README.md / README.ja.md /
# docs/index.html / docs/ja/index.html) to a published release, or check
# that every link currently in those files resolves.
#
#   bash scripts/update-download-links.sh 0.11.1   # rewrite to v0.11.1, then check
#   bash scripts/update-download-links.sh --check  # only check (exit 1 on any non-200)
#
# Links are pinned to `releases/download/v<version>/<file>` on purpose.
# `releases/latest/download/<file>` embeds the version in <file> anyway, so
# it breaks twice per release: the old file 404s the moment a new release
# becomes latest, and a new file 404s until that release is published
# (v0.11.1 sat like that for 17 days while the release was blocked).
# Pinned URLs never break, so this script is run AFTER publishing.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILES=(README.md README.ja.md docs/index.html docs/ja/index.html)

check_links() {
  local bad=0 url code
  while read -r url; do
    code=$(curl -sIL -o /dev/null -w '%{http_code}' "$url")
    printf '%s  %s\n' "$code" "$url"
    [ "$code" = "200" ] || bad=1
  done < <(cd "$REPO_ROOT" && grep -ohE 'https://github\.com/kashioka/Rendu/releases/(latest/download|download/v[0-9][^/]*)/[A-Za-z0-9_.-]+' "${FILES[@]}" | sort -u)
  if [ "$bad" -ne 0 ]; then
    echo "✗ some download links do not resolve" >&2
    return 1
  fi
  echo "✓ all download links resolve"
}

case "${1:-}" in
  --check)
    check_links
    ;;
  "")
    echo "Usage: $0 <version> | --check" >&2
    exit 1
    ;;
  *)
    VERSION="$1"
    if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
      echo "Error: Invalid version format: $VERSION" >&2
      exit 1
    fi
    for f in "${FILES[@]}"; do
      perl -pi -e '
        s{releases/latest/download/(Rendu[_-])}{releases/download/v'"$VERSION"'/$1}g;
        s{releases/download/v[0-9][^/]*/(Rendu[_-])}{releases/download/v'"$VERSION"'/$1}g;
        s{Rendu_[0-9][0-9.]*_(aarch64|amd64|x64)}{Rendu_'"$VERSION"'_$1}g;
        s{Rendu-[0-9][0-9.]*-1\.x86_64}{Rendu-'"$VERSION"'-1.x86_64}g;
      ' "$REPO_ROOT/$f"
    done
    echo "Rewrote download links to v$VERSION in: ${FILES[*]}"
    check_links
    ;;
esac
