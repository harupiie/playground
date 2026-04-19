import { copyFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const ARTICLES = join(ROOT, 'src/data/articles.json');
const BACKUP   = join(ROOT, 'src/data/articles.json.bak');
const FIXTURE  = join(ROOT, 'tests/e2e/fixtures/articles.json');

/**
 * テストスイート開始前に1回だけ実行される。
 * articles.json をバックアップし、フィクスチャデータに差し替える。
 * これにより pnpm build が確定的なテストデータでビルドされる。
 */
export default function globalSetup() {
  copyFileSync(ARTICLES, BACKUP);
  copyFileSync(FIXTURE, ARTICLES);
}
