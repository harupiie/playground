import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

const parser = new Parser();
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; ai-feed-reader/1.0)' };

export async function fetchOpenAICodex() {
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
  const res = await fetch(url, { headers: HEADERS });
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
  const res = await fetch('https://cursor.com/blog', { headers: HEADERS });
  const html = await res.text();
  const $ = cheerio.load(html);

  const seen = new Set();
  const articles = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('/blog/') || href === '/blog' || href === '/blog/' || seen.has(href)) return;

    const container = $(el).closest('article, [class*="card"], [class*="post"], li, div');
    const title =
      container.find('h1, h2, h3, h4').first().text().trim() ||
      $(el).find('h1, h2, h3, h4').first().text().trim() ||
      $(el).text().trim();
    if (!title || title.length < 5) return;

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

  // DeepL allows up to 50 texts per request
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
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
