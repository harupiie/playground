import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

const parser = new Parser({ timeout: 30000 });
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; ai-feed-reader/1.0)' };
const FETCH_TIMEOUT_MS = 30000;

// スクレイピング先がハングしたとき fetch がタイムアウトなく待ち続けるのを防ぐ
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOpenAICodex() {
  // developers.openai.com/blog/topic/codex はRSSを持たないため、
  // 全記事フィードを取得してタイトル・URL・カテゴリで Codex 関連をフィルタする
  const feed = await parser.parseURL('https://openai.com/blog/rss.xml');
  return feed.items
    .filter(item =>
      item.title?.toLowerCase().includes('codex') ||
      item.link?.toLowerCase().includes('codex') ||
      (item.categories ?? []).some(c => c.toLowerCase().includes('codex'))
    )
    .map(item => ({
      title: item.title ?? '',
      link: item.link ?? '',
      date: item.pubDate ?? null,
      source: 'OpenAI',
      category: 'Codex',
    }));
}

export async function scrapeClaudeBlog(categorySlug, categoryLabel) {
  const url = `https://claude.com/blog/category/${categorySlug}`;
  const res = await fetchWithTimeout(url, { headers: HEADERS });
  const html = await res.text();
  const $ = cheerio.load(html);

  const seen = new Set();
  const articles = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('/blog/') || href.includes('/category/') || seen.has(href)) return;

    const container = $(el).closest('article, [class*="card"], [class*="post"], li, div');
    const title =
      container.find('h1, h2, h3, h4').first().text().trim() ||
      $(el).find('h1, h2, h3, h4').first().text().trim();
    if (!title) return;

    const datetime =
      container.find('time').attr('datetime') ||
      container.find('time').text().trim() ||
      null;

    seen.add(href);
    articles.push({
      title,
      link: `https://claude.com${href}`,
      date: datetime,
      source: 'Claude',
      category: categoryLabel,
    });
  });

  return articles;
}

export async function scrapeCursor() {
  const res = await fetchWithTimeout('https://cursor.com/blog', { headers: HEADERS });
  const html = await res.text();
  const $ = cheerio.load(html);

  const seen = new Set();
  const articles = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('/blog/') || href === '/blog' || href === '/blog/' || href.includes('/topic/') || seen.has(href)) return;

    const container = $(el).closest('article, [class*="card"], [class*="post"], li, div');
    const title =
      container.find('h1, h2, h3, h4').first().text().trim() ||
      $(el).find('h1, h2, h3, h4').first().text().trim();
    // $(el).text() フォールバックを使うとカード全体のテキスト（著者名・読了時間等）が混入するため、
    // h1-h4 が取れない場合はスキップ。長さ・改行・中黒（Cursor のメタデータ区切り文字）でノイズを三重チェック。
    if (!title || title.length < 5 || title.length > 200 || title.includes('\n') || title.includes('·')) return;

    const datetime =
      container.find('time').attr('datetime') ||
      container.find('time').text().trim() ||
      null;

    seen.add(href);
    articles.push({
      title,
      link: `https://cursor.com${href}`,
      date: datetime,
      source: 'Cursor',
      category: 'Blog',
    });
  });

  return articles;
}

export async function fetchAllFeeds() {
  const results = await Promise.allSettled([
    fetchOpenAICodex(),
    scrapeClaudeBlog('claude-code', 'Claude Code'),
    scrapeClaudeBlog('agents', 'Agents'),
    scrapeClaudeBlog('announcements', 'Product Announcements'),
    scrapeClaudeBlog('enterprise-ai', 'Enterprise AI'),
    scrapeCursor(),
  ]);

  const articles = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  const seen = new Set();
  const unique = articles.filter(a => {
    if (!a.link || seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  unique.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  return { updatedAt: new Date().toISOString(), articles: unique };
}

export async function translateTitles(articles) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    console.warn('DEEPL_API_KEY not set, skipping translation.');
    return articles;
  }

  const titles = articles.map(a => a.title);
  const translated = [];

  // DeepL API の1リクエスト上限が50件のためチャンク送信
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const res = await fetchWithTimeout('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: chunk, target_lang: 'JA', source_lang: 'EN' }),
    });

    if (!res.ok) {
      console.error('DeepL API error:', res.status, await res.text());
      return articles;
    }

    const data = await res.json();
    translated.push(...data.translations.map(t => t.text));
  }

  return articles.map((a, i) => ({ ...a, titleJa: translated[i] }));
}
