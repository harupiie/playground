import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const ROOT   = process.cwd();
const ARTICLES = join(ROOT, 'src/data/articles.json');
const BACKUP   = join(ROOT, 'src/data/articles.json.bak');

/**
 * テストスイート終了後に1回だけ実行される。
 * articles.json をバックアップから復元し、バックアップファイルを削除する。
 * テストが失敗・中断した場合でも必ず呼ばれるため、副作用が残らない。
 */
export default function globalTeardown() {
  if (existsSync(BACKUP)) {
    copyFileSync(BACKUP, ARTICLES);
    unlinkSync(BACKUP);
  }
}
