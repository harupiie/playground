import { execSync, spawn } from "node:child_process";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ARTICLES = join(ROOT, "src/data/articles.json");
const BACKUP = join(ROOT, "src/data/articles.json.bak");
const FIXTURE = join(ROOT, "tests/e2e/fixtures/articles.json");
const PID_FILE = join(ROOT, ".preview-pid");

/**
 * テストスイート開始前に1回だけ実行される。
 * articles.json をフィクスチャデータに差し替え、ビルドし、プレビューサーバーを起動する。
 *
 * webServer を使わずここでビルド・サーバー起動・応答待機を行う理由:
 * Playwright は globalSetup と webServer を並行起動するため、webServer に build を含めると
 * フィクスチャ適用前にビルドが走ってしまう。ここで一括管理することで順序を保証する。
 *
 * バックアップ元に git の HEAD を使う理由:
 * 前回の中断でファイルシステムが不整合（articles.json がフィクスチャのまま）でも、
 * コミット済み内容から確実に正しいデータを復元できるようにするため。
 */
export default async function globalSetup() {
  const committed = execSync("git show HEAD:src/data/articles.json", {
    cwd: ROOT,
  });
  writeFileSync(BACKUP, committed);
  copyFileSync(FIXTURE, ARTICLES);
  execSync("pnpm build", { cwd: ROOT, stdio: "inherit" });

  const preview = spawn("pnpm", ["preview"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });
  preview.unref();
  writeFileSync(PID_FILE, String(preview.pid));

  await waitFor("http://localhost:4321/playground/");
}

async function waitFor(url: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} not ready after ${timeoutMs}ms`);
}
