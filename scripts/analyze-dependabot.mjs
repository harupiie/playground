#!/usr/bin/env node
/**
 * Dependabot のオープン PR を一覧取得し、マージ可否の判断材料を stdout に出力するスクリプト。
 * AI エージェントがこの出力を受け取り、各 PR のトリアージを行う用途で使う。
 *
 * 使用前提: GitHub CLI（gh）がインストール済みで認証済みであること。
 */

import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

const prsJson = run(
  "gh pr list --author app/dependabot --json number,title,url,body --limit 30",
);
const prs = JSON.parse(prsJson);

if (prs.length === 0) {
  console.log("オープンな Dependabot PR はありません。");
  process.exit(0);
}

console.log("=== Dependabot PR 分析レポート ===");
console.log(`対象 PR 数: ${prs.length} 件\n`);

for (const pr of prs) {
  console.log(`## PR #${pr.number}: ${pr.title}`);
  console.log(`URL: ${pr.url}`);

  // 変更ファイルから直接依存か間接依存かを判定
  try {
    const files = run(`gh pr diff ${pr.number} --name-only`);
    const fileList = files.split("\n").filter(Boolean);
    const isDirect = fileList.includes("package.json");
    console.log(`変更ファイル: ${fileList.join(", ")}`);
    console.log(
      `依存種別: ${isDirect ? "直接依存（package.json 変更あり）" : "間接依存（pnpm-lock.yaml のみ）"}`,
    );
  } catch {
    console.log("変更ファイル: 取得失敗");
  }

  // PR 本文にはリリースノートや変更内容が含まれる
  if (pr.body) {
    const truncated =
      pr.body.length > 1000 ? `${pr.body.slice(0, 1000)}\n...(省略)` : pr.body;
    console.log(`\n本文:\n${truncated}`);
  }

  console.log("\n---\n");
}

// 現在の脆弱性状況（pnpm audit は脆弱性があると exit 1 するため catch で取得）
console.log("=== 現在の脆弱性（pnpm audit）===");
try {
  console.log(run("pnpm audit"));
} catch (e) {
  console.log(e.stdout ?? String(e));
}
