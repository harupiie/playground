#!/usr/bin/env node
/**
 * 指定した Dependabot PR の詳細情報を取得し stdout に出力するスクリプト。
 * AI エージェントがこの出力を受け取り、対応方針を詳細に調査する用途で使う。
 *
 * 使用前提: GitHub CLI（gh）がインストール済みで認証済みであること。
 * 使用方法: node scripts/analyze-dependabot-pr.mjs <PR番号>
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const prNumber = process.argv[2];
if (!prNumber) {
  console.error("使用方法: pnpm debug:dependabot-pr <PR番号>");
  process.exit(1);
}

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

function getBumpType(from, to) {
  const parse = (v) =>
    v
      .replace(/^[^\d]*/, "")
      .split(".")
      .map(Number);
  const [fMaj, fMin] = parse(from);
  const [tMaj, tMin] = parse(to);
  if (tMaj > fMaj) return "MAJOR";
  if (tMin > fMin) return "MINOR";
  return "PATCH";
}

// PR の基本情報を取得
const prJson = run(
  `gh pr view ${prNumber} --json number,title,url,body,headRefName`,
);
const pr = JSON.parse(prJson);

// タイトルからパッケージ名・バージョンを抽出
// 対応フォーマット:
//   "Bump X from A to B"
//   "build(deps): bump X from A to B"
const titleMatch = pr.title.match(/bump\s+(\S+)\s+from\s+(\S+)\s+to\s+(\S+)/i);
const packageName = titleMatch?.[1];
const fromVersion = titleMatch?.[2];
const toVersion = titleMatch?.[3];
const bumpType =
  fromVersion && toVersion ? getBumpType(fromVersion, toVersion) : "不明";

console.log("=== Dependabot PR 詳細分析 ===");
console.log(`PR #${pr.number}: ${pr.title}`);
console.log(`URL: ${pr.url}`);
console.log(`ブランチ: ${pr.headRefName}`);
console.log(`バンプ種別: ${bumpType} (${fromVersion} → ${toVersion})`);
console.log("");

// ローカルの package.json バージョンと照合
if (packageName) {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const localRaw = allDeps[packageName];
    if (localRaw) {
      const localVersion = localRaw.replace(/^[\^~>=<\s]+/, "");
      const alreadyApplied = localVersion === toVersion;
      console.log(`ローカルバージョン: ${localRaw}（実質 ${localVersion}）`);
      if (alreadyApplied) {
        console.log(
          "⚠️  警告: ローカルの package.json にはすでにバンプ先バージョンが適用済みの可能性があります",
        );
      }
    } else {
      console.log(
        `ローカルバージョン: package.json に "${packageName}" の記載なし（間接依存）`,
      );
    }
  } catch {
    console.log("ローカルバージョン: 取得失敗");
  }
  console.log("");
}

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

// PR 本文（HTML ストリップ済み・全文）
console.log("=== PR 本文（リリースノート・変更概要）===");
console.log(pr.body ? stripHtml(pr.body) : "(本文なし)");
console.log("");

// フル diff
console.log("=== diff ===");
try {
  console.log(run(`gh pr diff ${prNumber}`));
} catch {
  console.log("diff の取得に失敗しました。");
}
console.log("");

// プロジェクト内の利用箇所
if (packageName) {
  console.log(`=== "${packageName}" のプロジェクト内利用箇所 ===`);
  try {
    const usages = run(
      `grep -r --include="*.mjs" --include="*.ts" --include="*.astro" -l "${packageName}" --exclude-dir=node_modules --exclude-dir=dist .`,
    );
    console.log(usages || "（利用箇所なし）");
  } catch {
    console.log("（利用箇所なし）");
  }
  console.log("");
}

// 脆弱性との照合（pnpm audit --json でパッケージ名を自動照合）
console.log("=== 脆弱性チェック（pnpm audit）===");
let auditRaw = "";
try {
  auditRaw = run("pnpm audit --json");
} catch (e) {
  auditRaw = e.stdout ?? "";
}
try {
  const audit = JSON.parse(auditRaw);
  const vulns = Object.values(audit.vulnerabilities ?? audit.advisories ?? {});
  const affected = vulns.filter(
    (v) => (v.name ?? v.module_name) === packageName,
  );
  if (affected.length > 0) {
    console.log(
      `⚠️  "${packageName}" に関する脆弱性が見つかりました。このPRで修正される可能性があります:`,
    );
    for (const v of affected) {
      console.log(`  - [${v.severity}] ${v.title ?? v.overview}`);
    }
  } else {
    console.log(
      `"${packageName ?? "対象パッケージ"}" に関する既知の脆弱性は見つかりませんでした`,
    );
  }
} catch {
  console.log("audit 結果のパースに失敗しました。");
}
