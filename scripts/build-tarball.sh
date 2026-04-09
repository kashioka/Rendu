#!/bin/bash
# Package the built Rendu.app into a gzipped tarball for distribution.
# Run after `npm run build` (or `tauri build --bundles app`).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/macos/Rendu.app"
OUT_DIR="$PROJECT_DIR/src-tauri/target/release/bundle/tarball"
TARBALL_NAME="Rendu-macos-aarch64.tar.gz"
TARBALL_PATH="$OUT_DIR/$TARBALL_NAME"

echo "=== Building Rendu tarball ==="

if [ ! -d "$APP_PATH" ]; then
    echo "Error: $APP_PATH not found. Run 'npm run build' first."
    exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$TARBALL_PATH"

# Ensure no quarantine or other extended attrs pollute the archive
xattr -cr "$APP_PATH" 2>/dev/null || true

echo "→ Creating tarball..."
# -C to archive with Rendu.app at the root (no leading directory).
tar -czf "$TARBALL_PATH" -C "$(dirname "$APP_PATH")" "$(basename "$APP_PATH")"

echo ""
echo "✅ Tarball created: $TARBALL_PATH"
echo "   Size: $(du -h "$TARBALL_PATH" | cut -f1)"
