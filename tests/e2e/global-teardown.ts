import { copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ARTICLES = join(ROOT, "src/data/articles.json");
const BACKUP = join(ROOT, "src/data/articles.json.bak");
const PID_FILE = join(ROOT, ".preview-pid");

/**
 * テストスイート終了後に1回だけ実行される。
 * プレビューサーバーを停止し、articles.json をバックアップから復元する。
 *
 * Playwright は正常終了時に globalTeardown を呼ぶが、強制終了（Ctrl+C 等）では呼ばれない場合がある。
 * その場合は articles.json がフィクスチャのまま残るため、git restore src/data/articles.json で手動復元すること。
 */
export default function globalTeardown() {
	if (existsSync(PID_FILE)) {
		const pid = Number(readFileSync(PID_FILE, "utf-8"));
		// detached: true で起動したプロセスグループをまとめて終了する
		try {
			process.kill(-pid, "SIGTERM");
		} catch {}
		unlinkSync(PID_FILE);
	}
	if (existsSync(BACKUP)) {
		copyFileSync(BACKUP, ARTICLES);
		unlinkSync(BACKUP);
	}
}
