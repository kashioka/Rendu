# Rendu

Markdownファイルを快適に閲覧するためのデスクトップアプリケーション。

**[English](./README.md)**

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![License](https://img.shields.io/badge/License-MIT-green)

## ダウンロード

最新版は [**Releases**](https://github.com/kashioka/Rendu/releases) ページからダウンロードできます。

1. **Assets** から `Rendu-vX.X.X-macos.zip` をダウンロード
2. zipファイルを解凍
3. `Rendu.app` を **アプリケーション** フォルダに移動
4. 初回起動時、未署名のためセキュリティ警告が表示される場合があります:
   - アプリを右クリックして **開く** を選択、または
   - **システム設定 > プライバシーとセキュリティ** で **このまま開く** をクリック
5. この警告は初回のみ表示されます

> **注意:** 現在 macOS (Apple Silicon) のみ対応。

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

## クイックスタート

### 前提条件

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- macOS: Xcode Command Line Tools (`xcode-select --install`)

### インストール & 起動

```bash
git clone https://github.com/kashioka/Rendu.git
cd Rendu
npm install
npm run dev
```

### ビルド

```bash
npm run build
```

`.dmg` インストーラーが以下に生成されます:

```
src-tauri/target/release/bundle/dmg/Rendu_<version>_aarch64.dmg
```

## インストール (macOS)

上記の[ダウンロード](#ダウンロード)セクションが最も簡単な方法です。

ソースからビルドした場合、`.app` バンドルは以下に生成されます:

```
src-tauri/target/release/bundle/macos/Rendu.app
```

## 使い方

1. アプリを起動
2. **Open Folder** でMarkdownファイルがあるフォルダを選択
3. 左のファイルツリーから `.md` ファイルをクリック
4. 右パネルにレンダリング結果が表示される
5. 左ペイン下部の **Outline** で見出し一覧を確認、クリックでジャンプ
6. 上部の **PDF Export** ボタンでPDFに出力
7. 歯車アイコンからテーマカスタマイズ

## トラブルシューティング

### 初回実行時のセキュリティ警告

開発ビルドは未署名のため、ウイルス対策ソフト（Bitdefender等）がPDF保存などのファイル操作をブロックする場合があります。表示されたら **「アプリケーションを信頼する」** を選択してください。通常この警告は1度のみ表示されます。`cargo clean` 後の再ビルドで再度表示される場合があります。

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

