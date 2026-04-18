import { fetchAllFeeds, translateTitles } from '../src/lib/feeds.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../src/data/articles.json');
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 既存データを読み込む
let existing = { updatedAt: '', articles: [] };
if (existsSync(DATA_FILE)) {
  try {
    existing = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.warn('articles.json の読み込み失敗、新規作成します:', e.message);
  }
}

const existingByUrl = new Map(existing.articles.map(a => [a.link, a]));
console.log(`既存記事数: ${existingByUrl.size}`);

// 最新記事を取得
const { articles: fresh } = await fetchAllFeeds();

// 新着のみ抽出
const newArticles = fresh.filter(a => !existingByUrl.has(a.link));
console.log(`新着記事数: ${newArticles.length}`);

// 新着のみ翻訳（既存分は再翻訳不要。DeepL無料枠の節約にもなる）
const translatedNew = newArticles.length > 0 ? await translateTitles(newArticles) : [];

// マージ
for (const article of translatedNew) {
  existingByUrl.set(article.link, article);
}

// 1年以上前の記事を削除
const cutoff = Date.now() - ONE_YEAR_MS;
const merged = Array.from(existingByUrl.values());
const filtered = merged.filter(a => {
  if (!a.date) return true;
  return new Date(a.date).getTime() > cutoff;
});
const expiredCount = merged.length - filtered.length;
if (expiredCount > 0) console.log(`1年以上前の記事を ${expiredCount} 件削除`);

// 日付降順ソート
filtered.sort((a, b) => {
  if (!a.date) return 1;
  if (!b.date) return -1;
  return new Date(b.date) - new Date(a.date);
});

mkdirSync(join(__dirname, '../src/data'), { recursive: true });
writeFileSync(DATA_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), articles: filtered }, null, 2));
console.log(`更新後の記事数: ${filtered.length}`);
