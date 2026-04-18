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

/** 記事ページ HTML から公開日を取得（JSON-LD の datePublished を優先し、無いときだけ先頭の time を使う） */
function extractPublishedDate($) {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).html();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw.trim());
      const d = findDatePublishedInJsonLd(data);
      if (d) return d;
    } catch {
      /* ignore */
    }
  }
  const timeAttr = $('time').first().attr('datetime');
  const timeText = $('time').first().text().trim();
  if (timeAttr) return timeAttr;
  if (timeText) return timeText;
  return null;
}

function findDatePublishedInJsonLd(node) {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const d = findDatePublishedInJsonLd(n);
      if (d) return d;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (
    types.some(t => ['BlogPosting', 'Article', 'NewsArticle'].includes(t)) &&
    typeof node.datePublished === 'string'
  ) {
    return node.datePublished;
  }
  if (node['@graph']) {
    const d = findDatePublishedInJsonLd(node['@graph']);
    if (d) return d;
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === 'object') {
      const d = findDatePublishedInJsonLd(v);
      if (d) return d;
    }
  }
  return null;
}

const OPENAI_CATEGORIES = new Set(['product', 'research']);

export async function fetchOpenAINews() {
  const feed = await parser.parseURL('https://openai.com/blog/rss.xml');
  return feed.items
    .filter(item =>
      (item.categories ?? []).some(c => OPENAI_CATEGORIES.has(c.toLowerCase()))
    )
    .map(item => ({
      title: item.title ?? '',
      link: item.link ?? '',
      date: item.pubDate ?? null,
      source: 'OpenAI',
      category: item.categories?.[0] ?? '',
    }));
}

export async function scrapeClaudeBlog(categorySlug, categoryLabel) {
  const url = `https://claude.com/blog/category/${categorySlug}`;
  const res = await fetchWithTimeout(url, { headers: HEADERS });
  const html = await res.text();
  const $ = cheerio.load(html);

  const seen = new Set();
  const stubs = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('/blog/') || href.includes('/category/') || seen.has(href)) return;

    const container = $(el).closest('article, [class*="card"], [class*="post"], li, div');
    const title =
      container.find('h1, h2, h3, h4').first().text().trim() ||
      $(el).find('h1, h2, h3, h4').first().text().trim();
    if (!title) return;

    seen.add(href);
    stubs.push({
      title,
      link: `https://claude.com${href}`,
      source: 'Claude',
      category: categoryLabel,
    });
  });

  const articles = [];
  for (const stub of stubs) {
    try {
      const pageRes = await fetchWithTimeout(stub.link, { headers: HEADERS });
      if (!pageRes.ok) {
        console.warn(`Claude記事 HTTP ${pageRes.status}: ${stub.link}`);
        articles.push({ ...stub, date: null });
        continue;
      }
      const pageHtml = await pageRes.text();
      const $p = cheerio.load(pageHtml);
      const title = $p('h1').first().text().trim() || stub.title;
      const date = extractPublishedDate($p);
      articles.push({ ...stub, title, date });
    } catch (e) {
      console.warn(`Claude記事取得失敗: ${stub.link}`, e.message);
      articles.push({ ...stub, date: null });
    }
  }

  return articles;
}

const CURSOR_TOPIC_SLUGS = ['product', 'research'];

/** サイトマップに載らない新着が /blog/topic/* にだけ出ることがあるため、トピックページからも URL を拾う */
async function collectCursorBlogUrlsFromTopics() {
  const urlToTopic = new Map();
  for (const slug of CURSOR_TOPIC_SLUGS) {
    const topicUrl = `https://cursor.com/blog/topic/${slug}`;
    try {
      const res = await fetchWithTimeout(topicUrl, { headers: HEADERS });
      const html = await res.text();
      const $ = cheerio.load(html);
      $('a[href^="/blog/"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        if (!href.startsWith('/blog/') || href.includes('/topic/')) return;
        const url = `https://cursor.com${href}`;
        urlToTopic.set(url, slug);
      });
    } catch (e) {
      console.warn(`Cursor topic 取得失敗: ${topicUrl}`, e.message);
    }
  }
  return urlToTopic;
}

// サイトマップとトピック一覧からブログ記事URLを列挙し、毎回すべての記事ページを取得する。
// （差分のみ取得だと、既存URLの日付が誤ったまま残り、新着が正しく並ばないため）
export async function scrapeCursor() {
  const sitemapRes = await fetchWithTimeout('https://cursor.com/sitemap.xml', { headers: HEADERS });
  const sitemapXml = await sitemapRes.text();

  const fromSitemap = [...sitemapXml.matchAll(/<loc>(https:\/\/cursor\.com\/blog\/(?!topic\/)[^<]+)<\/loc>/g)]
    .map(m => m[1]);
  const urlToTopic = await collectCursorBlogUrlsFromTopics();
  const allUrls = [...new Set([...fromSitemap, ...urlToTopic.keys()])];

  console.log(
    `Cursor: 記事URL ${allUrls.length} 件（サイトマップ ${fromSitemap.length} 件、トピック補完 +${allUrls.length - fromSitemap.length} 件）`,
  );

  const articles = [];
  for (const url of allUrls) {
    try {
      const res = await fetchWithTimeout(url, { headers: HEADERS });
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim();
      const datetime = extractPublishedDate($);

      // トピックページから取得したURLはトピック名を使用、それ以外はページからカテゴリを抽出
      let category = 'Blog';
      if (urlToTopic.has(url)) {
        const topic = urlToTopic.get(url);
        category = topic.charAt(0).toUpperCase() + topic.slice(1);
      } else {
        // ページ内のトピックリンクからカテゴリを抽出
        const topicLink = $('a[href^="/blog/topic/"]').first().attr('href');
        if (topicLink) {
          const match = topicLink.match(/\/blog\/topic\/([^/]+)/);
          if (match) {
            const topic = match[1];
            category = topic.charAt(0).toUpperCase() + topic.slice(1);
          }
        }
      }

      if (!title) continue;
      articles.push({ title, link: url, date: datetime, source: 'Cursor', category });
    } catch (e) {
      console.warn(`Cursor記事取得失敗: ${url}`, e.message);
    }
  }

  return articles;
}

export async function fetchAllFeeds() {
  const results = await Promise.allSettled([
    fetchOpenAINews(),
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
