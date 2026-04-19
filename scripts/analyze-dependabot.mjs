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

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getBumpType(title) {
  const m = title.match(/bump\s+\S+\s+from\s+(\S+)\s+to\s+(\S+)/i);
  if (!m) return "不明";
  const parse = (v) =>
    v
      .replace(/^[^\d]*/, "")
      .split(".")
      .map(Number);
  const [fMaj, fMin] = parse(m[1]);
  const [tMaj, tMin] = parse(m[2]);
  if (tMaj > fMaj) return "MAJOR";
  if (tMin > fMin) return "MINOR";
  return "PATCH";
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
  const bumpType = getBumpType(pr.title);
  console.log(`## PR #${pr.number}: ${pr.title}`);
  console.log(`URL: ${pr.url}`);
  console.log(`バンプ種別: ${bumpType}`);

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

  // PR 本文（HTML ストリップ済み・最大 3000 文字）
  if (pr.body) {
    const text = stripHtml(pr.body);
    const truncated =
      text.length > 3000 ? `${text.slice(0, 3000)}\n...(省略)` : text;
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
