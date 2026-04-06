#!/bin/bash
# Rendu Installer
# ダブルクリックするだけでインストールできます

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Rendu.app"
APP_SRC="$SCRIPT_DIR/$APP_NAME"
APP_DEST="/Applications/$APP_NAME"

echo "==================================="
echo "  Rendu インストーラ"
echo "==================================="
echo ""

# Check if app exists in DMG
if [ ! -d "$APP_SRC" ]; then
    echo "エラー: $APP_NAME が見つかりません。"
    echo "DMGを開いた状態で実行してください。"
    echo ""
    read -n 1 -s -r -p "何かキーを押して終了..."
    exit 1
fi

# Copy to Applications
echo "→ $APP_NAME をアプリケーションフォルダにコピー中..."
if [ -d "$APP_DEST" ]; then
    rm -rf "$APP_DEST"
fi
cp -R "$APP_SRC" "$APP_DEST"

# Remove quarantine flag
echo "→ セキュリティ設定を構成中..."
xattr -cr "$APP_DEST"

echo ""
echo "✅ インストール完了！"
echo ""
echo "→ Rendu を起動します..."
open "$APP_DEST"

# Eject DMG
VOLUME_PATH="$(dirname "$SCRIPT_DIR")"
if [[ "$VOLUME_PATH" == /Volumes/* ]]; then
    sleep 1
    hdiutil detach "$VOLUME_PATH" -quiet 2>/dev/null
fi

exit 0
