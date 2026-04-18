# Rendu へのコントリビューション

コントリビューションを歓迎します。PR や Issue を送る前に、このガイドを一読してください。

**[English version](./CONTRIBUTING.md)**

## 前提条件

- Node.js 20 以上
- Rust（最新 stable）— Tauri のビルドに必要: https://www.rust-lang.org/tools/install

## 開発環境

```bash
npm ci
npm run dev          # Vite dev server（フロントのみ）
npm run tauri dev    # Tauri ネイティブ機能を含む起動
npm run test:run     # Vitest
npx tsc --noEmit     # 型チェック
```

## ブランチ命名規則

`main` に直接プッシュしないでください。以下の命名でブランチを切ってください。

| 種類 | 命名 | 例 |
|------|------|----|
| 新機能 | `feat/xxx` | `feat/drag-and-drop` |
| バグ修正 | `fix/xxx` | `fix/sidebar-scroll` |
| リファクタ | `refactor/xxx` | `refactor/split-app` |
| ドキュメント | `docs/xxx` | `docs/contributing` |
| CI・ビルド | `chore/xxx` | `chore/update-deps` |

フォークからPRを送る場合も同様です。`main` ブランチからではなく、上記の命名でブランチを作ってください。

## コミットメッセージ

Conventional Commits 形式で書いてください。

```
feat: 新機能
fix: バグ修正
docs: ドキュメントのみの変更
refactor: リファクタリング
chore: ビルド・依存関係の変更
```

## Pull Request

1. PRの説明には **何をしたか** と **確認方法** を書く
2. 新機能・バグ修正には **対応するテストを追加** する
3. CI（型チェック + テスト）が通っていることを確認してからレビュー依頼する
4. PRを出す前にローカルで確認:

```bash
npm run test:run   # Vitest
npx tsc --noEmit   # 型チェック
```

## マージポリシー

- **Squash merge** を使用します
- **1人以上の Approve** が必要です
- マージ後はブランチを削除してください

## AIツールの使用について

AI生成コードをPRに含める場合、コードの内容を理解し、テストが通ることを確認してからサブミットしてください。
