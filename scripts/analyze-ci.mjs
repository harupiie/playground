#!/usr/bin/env node
/**
 * 最新の CI/CD 失敗ログを取得して stdout に出力するスクリプト。
 * AI エージェントがこの出力を受け取り、原因分析と修正方針を提案する用途で使う。
 *
 * 使用前提: GitHub CLI（gh）がインストール済みで認証済みであること。
 */

import { execSync } from 'node:child_process';

const WORKFLOW = 'deploy.yml';
const LIMIT = 1;

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

// 最新の失敗 run を取得
const runsJson = run(
  `gh run list --workflow=${WORKFLOW} --status=failure --limit=${LIMIT} --json databaseId,displayTitle,createdAt,headBranch`
);
const runs = JSON.parse(runsJson);

if (runs.length === 0) {
  console.log('直近の失敗した CI/CD 実行はありません。');
  process.exit(0);
}

const { databaseId: runId, displayTitle, createdAt, headBranch } = runs[0];

console.log('=== CI/CD 失敗レポート ===');
console.log(`実行ID   : ${runId}`);
console.log(`ブランチ : ${headBranch}`);
console.log(`タイトル : ${displayTitle}`);
console.log(`日時     : ${new Date(createdAt).toLocaleString('ja-JP')}`);
console.log('');

// 失敗ジョブの詳細を取得
const jobsJson = run(`gh run view ${runId} --json jobs`);
const { jobs } = JSON.parse(jobsJson);
const failedJobs = jobs.filter(j => j.conclusion === 'failure');

console.log('=== 失敗したジョブ・ステップ ===');
for (const job of failedJobs) {
  console.log(`\n[ジョブ] ${job.name}`);
  const failedSteps = job.steps.filter(s => s.conclusion === 'failure');
  for (const step of failedSteps) {
    console.log(`  [ステップ] ${step.name}`);
  }
}

console.log('\n=== エラーログ ===');
try {
  const logs = run(`gh run view ${runId} --log-failed`);
  console.log(logs);
} catch {
  console.log('ログの取得に失敗しました。gh run view コマンドで手動確認してください。');
}
