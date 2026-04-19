import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllFeeds, translateTitles } from "../src/lib/feeds.mjs";
import { applyUpdates, filterExpired, sortByDate } from "../src/lib/merge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "../src/data/articles.json");
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 既存データを読み込む
let existing = { updatedAt: "", articles: [] };
if (existsSync(DATA_FILE)) {
  try {
    existing = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch (e) {
    console.warn("articles.json の読み込み失敗、新規作成します:", e.message);
  }
}

const existingByUrl = new Map(existing.articles.map((a) => [a.link, a]));
console.log(`既存記事数: ${existingByUrl.size}`);

// 最新記事を取得
const { articles: fresh } = await fetchAllFeeds();

// 既存URLはタイトル・日付を再取得結果で上書き（Cursor の日付修正やタイトル揺れの吸収）
const updatedByUrl = applyUpdates(existingByUrl, fresh);

// ソース別取得件数をログ
const bySource = fresh.reduce((acc, a) => {
  acc[a.source] = (acc[a.source] ?? 0) + 1;
  return acc;
}, {});
console.log(
  "取得件数:",
  Object.entries(bySource)
    .map(([k, v]) => `${k}=${v}`)
    .join(", "),
);

// 新着のみ抽出
const newArticles = fresh.filter((a) => !updatedByUrl.has(a.link));
console.log(`新着記事数: ${newArticles.length}`);

// 新着のみ翻訳（既存分は再翻訳不要。DeepL無料枠の節約にもなる）
const translatedNew =
  newArticles.length > 0 ? await translateTitles(newArticles) : [];

// マージ
for (const article of translatedNew) {
  updatedByUrl.set(article.link, article);
}

// 1年以上前の記事を削除
const cutoff = Date.now() - ONE_YEAR_MS;
const merged = Array.from(updatedByUrl.values());
const filtered = filterExpired(merged, cutoff);
const expiredCount = merged.length - filtered.length;
if (expiredCount > 0) console.log(`1年以上前の記事を ${expiredCount} 件削除`);

// 日付降順ソート
const sorted = sortByDate(filtered);

mkdirSync(join(__dirname, "../src/data"), { recursive: true });
writeFileSync(
  DATA_FILE,
  JSON.stringify(
    { updatedAt: new Date().toISOString(), articles: sorted },
    null,
    2,
  ),
);
console.log(`更新後の記事数: ${sorted.length}`);
process.exit(0);
