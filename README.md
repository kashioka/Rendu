# Markdown Viewer

Markdownファイルを閲覧するデスクトップアプリ。左側にファイルツリー、右側にMarkdownのレンダリング表示。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップFW | Tauri 2.0 |
| フロントエンド | React + TypeScript + Vite |
| MDレンダリング | react-markdown + remark-gfm + rehype-highlight |
| 図表 | Mermaid |
| スタイリング | Tailwind CSS |

## 機能

- フォルダ選択 → ファイルツリー表示（再帰的に展開可能）
- `.md` / `.markdown` ファイルのレンダリング表示
- GFM対応（テーブル、取り消し線、タスクリスト等）
- コードブロックのシンタックスハイライト
- Mermaid記法の図表レンダリング（フローチャート、シーケンス図、ER図等）
- 設定画面でカラーテーマのカスタマイズ（リアルタイムプレビュー、自動保存）

## セットアップ

### 前提条件

- Node.js 18+
- Rust（`rustup` でインストール）
- macOS: Xcode Command Line Tools

### インストール

```bash
cd md-viewer
npm install
```

### 開発モード

```bash
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri dev
```

### ビルド

```bash
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri build --bundles app
```

ビルド成果物: `src-tauri/target/release/bundle/macos/Markdown Viewer.app`

### アプリケーションフォルダへのインストール

```bash
cp -r src-tauri/target/release/bundle/macos/Markdown\ Viewer.app /Applications/
```

## 使い方

1. アプリを起動
2. 「Open Folder」でMarkdownファイルがあるフォルダを選択
3. 左のファイルツリーから `.md` ファイルをクリック
4. 右パネルにレンダリング結果が表示される
5. 歯車アイコンから色のカスタマイズが可能
