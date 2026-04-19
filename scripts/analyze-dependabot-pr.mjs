#!/usr/bin/env node
/**
 * 指定した Dependabot PR の詳細情報を取得し stdout に出力するスクリプト。
 * AI エージェントがこの出力を受け取り、対応方針を詳細に調査する用途で使う。
 *
 * 使用前提: GitHub CLI（gh）がインストール済みで認証済みであること。
 * 使用方法: node scripts/analyze-dependabot-pr.mjs <PR番号>
 */

import { execSync } from "node:child_process";

const prNumber = process.argv[2];
if (!prNumber) {
  console.error("使用方法: pnpm debug:dependabot-pr <PR番号>");
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

// PR の基本情報を取得
const prJson = run(
  `gh pr view ${prNumber} --json number,title,url,body,headRefName,author`,
);
const pr = JSON.parse(prJson);

console.log("=== Dependabot PR 詳細分析 ===");
console.log(`PR #${pr.number}: ${pr.title}`);
console.log(`URL: ${pr.url}`);
console.log(`ブランチ: ${pr.headRefName}`);
console.log("");

// 変更ファイルと依存種別
const files = run(`gh pr diff ${prNumber} --name-only`)
  .split("\n")
  .filter(Boolean);
const isDirect = files.includes("package.json");
console.log(`変更ファイル: ${files.join(", ")}`);
console.log(
  `依存種別: ${isDirect ? "直接依存（package.json 変更あり）" : "間接依存（pnpm-lock.yaml のみ）"}`,
);
console.log("");

// PR 本文（リリースノート・チェンジログへのリンクを含む）
console.log("=== PR 本文（リリースノート・変更概要）===");
console.log(pr.body ?? "(本文なし)");
console.log("");

// フル diff
console.log("=== diff ===");
try {
  console.log(run(`gh pr diff ${prNumber}`));
} catch {
  console.log("diff の取得に失敗しました。");
}
console.log("");

// パッケージ名をタイトルから抽出してプロジェクト内の利用箇所を検索
// タイトル例: "Bump @playwright/test from 1.59.1 to 1.60.0"
const match = pr.title.match(/^Bump\s+(\S+)\s+from/i);
if (match) {
  const packageName = match[1];
  console.log(`=== "${packageName}" のプロジェクト内利用箇所 ===`);
  try {
    // import / require でパッケージを参照している箇所を検索（node_modules・dist を除く）
    const usages = run(
      `grep -r --include="*.mjs" --include="*.ts" --include="*.astro" -l "${packageName}" --exclude-dir=node_modules --exclude-dir=dist .`,
    );
    console.log(usages || "（利用箇所なし）");
  } catch {
    console.log("（利用箇所なし）");
  }
  console.log("");
}

// 現在の脆弱性状況
console.log("=== 現在の脆弱性（pnpm audit）===");
try {
  console.log(run("pnpm audit"));
} catch (e) {
  console.log(e.stdout ?? String(e));
}
