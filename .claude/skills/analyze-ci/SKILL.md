---
name: analyze-ci
description: CI/CD の失敗ログを取得して原因分析と修正方針を提案する
argument-hint: "[runId]"
---

引数が指定されていれば `pnpm debug:ci $ARGUMENTS`（指定した runId の失敗を取得）、なければ `pnpm debug:ci`（最新の失敗 run を取得）を実行して CI/CD 失敗ログを取得し、以下を行ってください。

1. 失敗したジョブ・ステップの特定
2. エラーメッセージから根本原因を分析
3. 具体的な修正方針の提案
