import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const ROOT   = process.cwd();
const ARTICLES = join(ROOT, 'src/data/articles.json');
const BACKUP   = join(ROOT, 'src/data/articles.json.bak');

/**
 * テストスイート終了後に1回だけ実行される。
 * articles.json をバックアップから復元し、バックアップファイルを削除する。
 *
 * Playwright は正常終了時に globalTeardown を呼ぶが、強制終了（Ctrl+C 等）では呼ばれない場合がある。
 * その場合は articles.json がフィクスチャのまま残るため、git restore src/data/articles.json で手動復元すること。
 */
export default function globalTeardown() {
  if (existsSync(BACKUP)) {
    copyFileSync(BACKUP, ARTICLES);
    unlinkSync(BACKUP);
  }
}
