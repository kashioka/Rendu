#!/bin/bash
# Build a custom DMG with Rendu.app and installer script
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/macos/Rendu.app"
DMG_DIR="$PROJECT_DIR/src-tauri/target/release/bundle/dmg"
DMG_NAME="Rendu_0.1.0_aarch64.dmg"
DMG_PATH="$DMG_DIR/$DMG_NAME"
VOLUME_NAME="Rendu"
STAGING_DIR=$(mktemp -d)

echo "=== Building custom DMG ==="

# Check that app exists
if [ ! -d "$APP_PATH" ]; then
    echo "Error: $APP_PATH not found. Run 'tauri build --bundles app' first."
    exit 1
fi

# Prepare staging directory
echo "→ Staging files..."
cp -R "$APP_PATH" "$STAGING_DIR/Rendu.app"
cp "$SCRIPT_DIR/install.command" "$STAGING_DIR/インストール.command"
chmod +x "$STAGING_DIR/インストール.command"
ln -s /Applications "$STAGING_DIR/Applications"

# Remove old DMG if exists
mkdir -p "$DMG_DIR"
rm -f "$DMG_PATH"

# Create DMG
echo "→ Creating DMG..."
hdiutil create -volname "$VOLUME_NAME" \
    -srcfolder "$STAGING_DIR" \
    -ov -format UDZO \
    "$DMG_PATH"

# Cleanup
rm -rf "$STAGING_DIR"

echo ""
echo "✅ DMG created: $DMG_PATH"
echo "   Size: $(du -h "$DMG_PATH" | cut -f1)"
