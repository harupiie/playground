import { writeFileSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = process.cwd();
const ARTICLES = join(ROOT, 'src/data/articles.json');
const BACKUP   = join(ROOT, 'src/data/articles.json.bak');
const FIXTURE  = join(ROOT, 'tests/e2e/fixtures/articles.json');

/**
 * テストスイート開始前に1回だけ実行される。
 * articles.json をフィクスチャデータに差し替え、確定的なデータでビルドする。
 *
 * ビルドをここで実行する理由:
 * Playwright は globalSetup と webServer を並行起動するため、
 * webServer の command に build を含めると差し替え前の articles.json でビルドされてしまう。
 * globalSetup 内でビルドまで完了させることで、フィクスチャ適用 → ビルド → preview の順序を保証する。
 *
 * バックアップ元に git の HEAD を使う理由:
 * 前回の中断でファイルシステムが不整合（articles.json がフィクスチャのまま）でも、
 * コミット済み内容から確実に正しいデータを復元できるようにするため。
 */
export default function globalSetup() {
  const committed = execSync('git show HEAD:src/data/articles.json', { cwd: ROOT });
  writeFileSync(BACKUP, committed);
  copyFileSync(FIXTURE, ARTICLES);
  execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });
}
