#!/usr/bin/env python3
"""外部コントリビュータの PR を Claude でレビューし、結果を標準出力に書き出す。

pr-review.yml ワークフローから呼び出される。以下の環境変数を読む:
  ANTHROPIC_API_KEY  Anthropic API キー
  PR_DIFF            レビュー対象の差分（コード拡張子のみ・先頭 12000 文字程度）
  PR_TITLE           PR タイトル
  PR_AUTHOR          PR 作成者ログイン名
"""
import json
import os
import sys
import urllib.request

diff = os.environ.get("PR_DIFF", "")
title = os.environ.get("PR_TITLE", "")
author = os.environ.get("PR_AUTHOR", "")

prompt = f"""以下の外部コントリビュータのPRをコードレビューしてください。

PR タイトル: {title}
PR 作成者: {author}

## 変更差分
{diff}

## レビュー観点
- バグ・ロジックエラーの可能性
- 型安全性（TypeScript）
- パフォーマンス上の懸念
- 設計・構造の問題
- マージしてよいかの総合判断

## 出力フォーマット
🔴 **問題点** があれば箇条書き（マージブロッカーになるもの）
🟡 **改善提案** があれば箇条書き（あると良いもの）
✅ **良い点** があれば箇条書き
📝 **総評** を2〜3行で
🔀 **マージ推奨度**: ✅ 推奨 / 🟡 修正後推奨 / 🔴 非推奨

問題がなければ「✅ 特に問題なし」と記載してください。"""

payload = {
    "model": "claude-sonnet-4-6",
    "max_tokens": 1500,
    "messages": [{"role": "user", "content": prompt}],
}

req = urllib.request.Request(
    "https://api.anthropic.com/v1/messages",
    data=json.dumps(payload).encode(),
    headers={
        "Content-Type": "application/json",
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
    },
)

with urllib.request.urlopen(req) as res:
    result = json.loads(res.read())

sys.stdout.write(result["content"][0]["text"])
