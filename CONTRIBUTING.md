# Contributing to Rendu

## ブランチ命名規則

`main` に直接プッシュしないでください。以下の命名でブランチを切ってください。

| 種類 | 命名 | 例 |
|------|------|----|
| 新機能 | `feat/xxx` | `feat/drag-and-drop` |
| バグ修正 | `fix/xxx` | `fix/sidebar-scroll` |
| リファクタ | `refactor/xxx` | `refactor/split-app` |
| ドキュメント | `docs/xxx` | `docs/contributing` |
| CI・ビルド | `chore/xxx` | `chore/update-deps` |

## Pull Request

1. フォークからPRを送る場合も、`main` ではなく上記の命名でブランチを作る
2. PRの説明には **何をしたか** と **確認方法** を書く
3. CI（型チェック + テスト）が通っていることを確認してからレビュー依頼する

## テスト

- 新機能・バグ修正には **対応するテストを追加** する
- PRを出す前にローカルで確認:

```bash
npm run test:run   # Vitest
npx tsc --noEmit   # 型チェック
```

## 開発環境

```bash
npm ci
npm run dev        # Vite dev server
npm run test:run   # テスト実行
npx tsc --noEmit   # 型チェック
```

Tauri のネイティブ機能を使うときは `npm run tauri dev` で起動してください。
