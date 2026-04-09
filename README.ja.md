# Rendu

Markdownファイルを快適に閲覧するためのデスクトップアプリケーション。

**[English](./README.md)**

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![License](https://img.shields.io/badge/License-MIT-green)

## クイックスタート

**macOS Apple Silicon 専用です。**

**ターミナル** を開いて、以下のコマンドを実行してください:

```bash
curl -fsSL https://github.com/kashioka/Rendu/releases/latest/download/install.sh | bash
```

これだけで完了です。インストーラが Rendu をダウンロードし、`/Applications` にコピーし、macOS の検疫フラグを解除して、アプリを起動します。

**2回目以降の起動は通常のアプリと同じです。** Launchpad、Spotlight、アプリケーションフォルダから開けます。ターミナルが必要なのは初回インストール時だけです。

> **なぜ初回だけターミナル？** Rendu は Apple Developer ID で署名されていないため、新しい macOS（Sequoia / Tahoe）では `.app` をダブルクリックすると「壊れています」「検証できません」というエラーで開けません。ターミナルから実行することでこの制約を安全に回避できます。一度インストールすれば、以降は特別な操作は不要です。

## 特徴

- **ファイルツリー** — フォルダを開いて `.md` / `.markdown` ファイルをツリー形式でブラウズ
- **Markdownレンダリング** — GFM（テーブル、タスクリスト、取り消し線等）に完全対応
- **シンタックスハイライト** — コードブロックの自動ハイライト
- **Mermaid図表** — フローチャート、シーケンス図、ER図などをインライン描画
- **ドキュメントアウトライン** — 見出し一覧を左ペイン下部に表示、クリックでジャンプ
- **PDF出力** — 表示中のMarkdownをA4サイズのPDFとしてエクスポート
- **テーマカスタマイズ** — 背景色・文字色・コードブロック色などをリアルタイムに変更
- **リサイザブルUI** — ファイルツリーとアウトラインの境界をドラッグで調整可能

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップFW | Tauri 2.0 (Rust) |
| フロントエンド | React 19 + TypeScript + Vite |
| MDレンダリング | react-markdown + remark-gfm + rehype-highlight |
| 図表 | Mermaid |
| PDF出力 | html2pdf.js |
| スタイリング | Tailwind CSS 4 |

## 使い方

1. アプリを起動
2. **フォルダを開く** からMarkdownファイルがあるフォルダを選択、または **ファイルを開く** から単一ファイルを開く
3. 右パネルにレンダリング結果が表示される
4. 左ペイン下部の **Outline** で見出し一覧を確認、クリックでジャンプ
5. 上部の **PDF Export** ボタンでPDFに出力
6. 歯車アイコンからテーマカスタマイズ

## うまくいかないときは

### インストーラが失敗する / 各ステップを自分で確認したい

手動でダウンロード・インストールする手順:

```bash
curl -LO https://github.com/kashioka/Rendu/releases/latest/download/Rendu-macos-aarch64.tar.gz
tar xzf Rendu-macos-aarch64.tar.gz
xattr -cr Rendu.app
mv Rendu.app /Applications/
open /Applications/Rendu.app
```

すべてのバージョンとリリースノートは [Releases](https://github.com/kashioka/Rendu/releases) ページから確認できます。

### 「"Rendu"は壊れているため開けません」と表示される

検疫フラグが残っているのが原因です。以下を実行してから再度起動してください:

```bash
xattr -cr /Applications/Rendu.app
```

### 初回実行時のセキュリティ警告

未署名ビルドのため、ウイルス対策ソフト（Bitdefender等）がPDF保存などのファイル操作をブロックする場合があります。表示されたら **「アプリケーションを信頼する」** を選択してください。通常この警告は1度のみ表示されます。`cargo clean` 後の再ビルドで再度表示される場合があります。

## 開発者向け

Rendu をローカルで開発・ビルドしたい開発者・コントリビューター向けの手順です。

**前提条件**

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- Xcode Command Line Tools (`xcode-select --install`)

**リポジトリを取得して依存関係をインストール**

```bash
git clone https://github.com/kashioka/Rendu.git
cd Rendu
npm install
```

**開発モードで起動**

```bash
npm run dev
```

**リリースビルド**

```bash
npm run build
./scripts/build-tarball.sh
```

生成される成果物:

```
src-tauri/target/release/bundle/macos/Rendu.app
src-tauri/target/release/bundle/tarball/Rendu-macos-aarch64.tar.gz
```

## プロジェクト構成

```
Rendu/
├── src/
│   ├── components/
│   │   ├── FileTree.tsx        # ファイルツリーブラウザ
│   │   ├── MarkdownViewer.tsx  # Markdownレンダリング + PDF出力
│   │   ├── MermaidBlock.tsx    # Mermaid図表レンダリング
│   │   ├── OutlinePanel.tsx    # ドキュメントアウトライン
│   │   └── Settings.tsx        # テーマ設定パネル
│   ├── App.tsx                 # メインレイアウト
│   ├── main.tsx                # エントリポイント
│   ├── useSettings.ts          # テーマ設定hooks
│   └── index.css               # グローバルスタイル
├── src-tauri/
│   ├── src/                    # Rustバックエンド
│   ├── capabilities/           # Tauri権限設定
│   └── tauri.conf.json         # Tauri設定
└── package.json
```

## ライセンス

MIT
