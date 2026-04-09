#!/bin/bash
# Rendu remote installer
#
# Usage (from Terminal):
#   curl -fsSL https://github.com/kashioka/Rendu/releases/latest/download/install.sh | bash
#
# This script downloads the latest Rendu release, installs it to /Applications,
# removes the macOS quarantine flag, and launches the app.
set -e

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
REPO="kashioka/Rendu"
ARCHIVE_NAME="Rendu-macos-aarch64.tar.gz"
APP_NAME="Rendu.app"
APP_DEST="/Applications/${APP_NAME}"

# Allow overriding the release tag (defaults to latest).
RELEASE_TAG="${RENDU_RELEASE_TAG:-latest}"
if [ "$RELEASE_TAG" = "latest" ]; then
    ARCHIVE_URL="https://github.com/${REPO}/releases/latest/download/${ARCHIVE_NAME}"
else
    ARCHIVE_URL="https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${ARCHIVE_NAME}"
fi

# -----------------------------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------------------------
if [ "$(uname)" != "Darwin" ]; then
    echo "Error: This installer is for macOS only."
    exit 1
fi

ARCH="$(uname -m)"
if [ "$ARCH" != "arm64" ]; then
    echo "Error: This build supports Apple Silicon (arm64) only. Detected: $ARCH"
    exit 1
fi

# -----------------------------------------------------------------------------
# Download & install
# -----------------------------------------------------------------------------
echo "==================================="
echo "  Rendu インストーラ / Installer"
echo "==================================="
echo ""

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "→ ダウンロード中 / Downloading..."
echo "  $ARCHIVE_URL"
if ! curl -fL --progress-bar -o "$TMPDIR/$ARCHIVE_NAME" "$ARCHIVE_URL"; then
    echo ""
    echo "エラー: ダウンロードに失敗しました。"
    echo "Error: download failed. Check your network connection and release URL."
    exit 1
fi

echo ""
echo "→ 展開中 / Extracting..."
tar xzf "$TMPDIR/$ARCHIVE_NAME" -C "$TMPDIR"

if [ ! -d "$TMPDIR/$APP_NAME" ]; then
    echo "エラー: アーカイブ内に $APP_NAME が見つかりません。"
    echo "Error: archive did not contain $APP_NAME"
    exit 1
fi

if [ -d "$APP_DEST" ]; then
    echo "→ 既存のインストールを削除 / Removing previous installation..."
    rm -rf "$APP_DEST"
fi

echo "→ アプリケーションフォルダにコピー / Copying to /Applications..."
mv "$TMPDIR/$APP_NAME" "$APP_DEST"

echo "→ 検疫フラグを除去 / Removing quarantine flag..."
xattr -cr "$APP_DEST" 2>/dev/null || true

echo ""
echo "✅ インストール完了 / Installation complete!"
echo ""
echo "→ Rendu を起動します / Launching Rendu..."
open "$APP_DEST"

echo ""
echo "💡 次回からは Launchpad・Spotlight・アプリケーションフォルダから"
echo "   通常のアプリと同じように起動できます。ターミナルは不要です。"
echo ""
echo "   From now on, launch Rendu from Launchpad, Spotlight, or"
echo "   the Applications folder — just like any other app."

exit 0
