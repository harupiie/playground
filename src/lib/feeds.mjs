import * as cheerio from "cheerio";
import Parser from "rss-parser";

const parser = new Parser({ timeout: 30000 });

// スクレイピング時に送る User-Agent。ボットブロックを避けるためブラウザに近い文字列にしている
const HEADERS = {
	"User-Agent": "Mozilla/5.0 (compatible; ai-feed-reader/1.0)",
};

// fetch のタイムアウト（ms）。スクレイピング先がハングしたとき無限に待ち続けるのを防ぐ
const FETCH_TIMEOUT_MS = 30000;

/**
 * タイムアウト付きの fetch。
 * Node.js 標準の fetch にはタイムアウトオプションがないため、
 * AbortController でキャンセルシグナルを発行して代替する。
 */
async function fetchWithTimeout(url, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} finally {
		// fetch が正常に完了した場合もタイマーを必ずクリアする
		clearTimeout(timer);
	}
}

/**
 * 記事ページの HTML から公開日を取得する。
 * JSON-LD の datePublished を優先し、存在しない場合のみ <time> タグにフォールバックする。
 *
 * 優先順位:
 * 1. <script type="application/ld+json"> 内の datePublished
 * 2. <time datetime="..."> 属性
 * 3. <time> タグのテキスト内容
 *
 * @param {import('cheerio').CheerioAPI} $ - cheerio.load() で得た $ オブジェクト
 * @returns {string | null} 日付文字列、見つからなければ null
 */
export function extractPublishedDate($) {
	// ページ内の全 JSON-LD スクリプトを順に確認する
	for (const el of $('script[type="application/ld+json"]').toArray()) {
		const raw = $(el).html();
		if (!raw) continue;
		try {
			const data = JSON.parse(raw.trim());
			const d = findDatePublishedInJsonLd(data);
			if (d) return d;
		} catch {
			// JSON のパースに失敗した場合は無視して次の手段（time タグ）に進む
		}
	}

	// JSON-LD で見つからなかった場合は <time> タグから取得を試みる
	const timeAttr = $("time").first().attr("datetime");
	const timeText = $("time").first().text().trim();
	if (timeAttr) return timeAttr;
	if (timeText) return timeText;
	return null;
}

/**
 * JSON-LD ノードを再帰的に探索し、datePublished を返す。
 *
 * JSON-LD はサイトによって構造がバラバラなため（フラット・@graph でのラップ・深いネストなど）、
 * 再帰探索で形状に依存せず datePublished にたどり着けるようにしている。
 *
 * 探索ルール（優先順）:
 * 1. ノードが配列なら各要素を再帰探索し、最初にヒットした値を返す
 * 2. ノードが null・プリミティブならスキップ（null を返す）
 * 3. @type が BlogPosting / Article / NewsArticle のいずれかで
 *    datePublished が文字列なら、その値を返す
 * 4. @graph キーがあれば、その値を優先して再帰探索する
 * 5. その他のオブジェクト値を再帰探索する（深いネストに対応）
 *
 * @param {unknown} node - JSON.parse 後の JSON-LD データ（任意の形状）
 * @returns {string | null} datePublished の値、見つからなければ null
 */
export function findDatePublishedInJsonLd(node) {
	// ルール2: null / undefined はスキップ
	if (node == null) return null;

	// ルール1: 配列は各要素を順に探索
	if (Array.isArray(node)) {
		for (const n of node) {
			const d = findDatePublishedInJsonLd(n);
			if (d) return d;
		}
		return null;
	}

	// ルール2: プリミティブ（string / number / boolean）はスキップ
	if (typeof node !== "object") return null;

	// ルール3: 認識対象の @type かつ datePublished が文字列なら返す
	// @type は "BlogPosting" のような文字列の場合と ["BlogPosting", "Article"] のような配列の場合がある
	const type = node["@type"];
	const types = Array.isArray(type) ? type : [type];
	if (
		types.some((t) => ["BlogPosting", "Article", "NewsArticle"].includes(t)) &&
		typeof node.datePublished === "string"
	) {
		return node.datePublished;
	}

	// ルール4: @graph を優先して再帰探索（通常の値より先に処理）
	// @graph は1ページに複数エンティティを記述する際に使われる JSON-LD の標準キー
	if (node["@graph"]) {
		const d = findDatePublishedInJsonLd(node["@graph"]);
		if (d) return d;
	}

	// ルール5: その他のオブジェクト値を再帰探索
	for (const k of Object.keys(node)) {
		const v = node[k];
		if (v && typeof v === "object") {
			const d = findDatePublishedInJsonLd(v);
			if (d) return d;
		}
	}
	return null;
}

// OpenAI RSS で取得対象とするカテゴリ（小文字で比較）
const OPENAI_CATEGORIES = new Set(["product", "research"]);

/**
 * OpenAI ブログの RSS フィードから Product・Research カテゴリの記事を取得する。
 * OpenAI は RSS で pubDate を提供しているため、HTML スクレイピングは不要。
 */
export async function fetchOpenAINews() {
	const feed = await parser.parseURL("https://openai.com/blog/rss.xml");
	return feed.items
		.filter((item) =>
			// categories は配列で複数カテゴリが付くことがある。1つでも対象なら含める
			(item.categories ?? []).some((c) =>
				OPENAI_CATEGORIES.has(c.toLowerCase()),
			),
		)
		.map((item) => ({
			title: item.title ?? "",
			link: item.link ?? "",
			date: item.pubDate ?? null,
			source: "OpenAI",
			category: item.categories?.[0] ?? "", // 先頭カテゴリをバッジ表示用に使用
		}));
}

/**
 * Claude ブログの指定カテゴリページをスクレイピングし、記事一覧を取得する。
 *
 * 取得フロー:
 * 1. カテゴリ一覧ページ（/blog/category/<slug>）から記事 URL とタイトルを収集（スタブ）
 * 2. 各記事ページに個別アクセスし、h1 タイトルと公開日を取得
 *
 * カテゴリ一覧ページのスクレイピングにとどめず個別ページも取得するのは、
 * 一覧ページのタイトルが省略・加工されている場合があるため。
 *
 * @param {string} categorySlug - URL に使うスラッグ（例: 'claude-code'）
 * @param {string} categoryLabel - バッジ表示用のラベル（例: 'Claude Code'）
 */
export async function scrapeClaudeBlog(categorySlug, categoryLabel) {
	const url = `https://claude.com/blog/category/${categorySlug}`;
	const res = await fetchWithTimeout(url, { headers: HEADERS });
	const html = await res.text();
	const $ = cheerio.load(html);

	const seen = new Set();
	const stubs = [];

	// ページ内の全リンクを走査して記事 URL を収集する
	$("a[href]").each((_, el) => {
		const href = $(el).attr("href") ?? "";
		// /blog/ 配下かつカテゴリページでないもの、かつ未収集のものに絞る
		if (
			!href.startsWith("/blog/") ||
			href.includes("/category/") ||
			seen.has(href)
		)
			return;

		// リンクを含む親要素（記事カード相当）からタイトルを取得する
		const container = $(el).closest(
			'article, [class*="card"], [class*="post"], li, div',
		);
		const title =
			container.find("h1, h2, h3, h4").first().text().trim() ||
			$(el).find("h1, h2, h3, h4").first().text().trim();
		if (!title) return; // タイトルが取れない要素は無視

		seen.add(href);
		stubs.push({
			title,
			link: `https://claude.com${href}`,
			source: "Claude",
			category: categoryLabel,
		});
	});

	// 各記事ページに個別アクセスして正確なタイトルと公開日を取得する
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
			// 記事ページの h1 が最も正確なタイトル。取れなければスタブのタイトルを使う
			const title = $p("h1").first().text().trim() || stub.title;
			const date = extractPublishedDate($p);
			articles.push({ ...stub, title, date });
		} catch (e) {
			console.warn(`Claude記事取得失敗: ${stub.link}`, e.message);
			articles.push({ ...stub, date: null });
		}
	}

	return articles;
}

// Cursor ブログで取得対象とするトピックスラッグ
const CURSOR_TOPIC_SLUGS = ["product", "research"];

/**
 * Cursor のトピックページ（/blog/topic/<slug>）から記事 URL を収集する。
 *
 * サイトマップへの反映に時差があるため、サイトマップだけでは新着を見逃すことがある。
 * トピックページを補完的に使い、未収録の新着 URL を拾う。
 *
 * @returns {Map<string, string>} URL → トピックスラッグ のマップ
 */
async function collectCursorBlogUrlsFromTopics() {
	const urlToTopic = new Map();
	for (const slug of CURSOR_TOPIC_SLUGS) {
		const topicUrl = `https://cursor.com/blog/topic/${slug}`;
		try {
			const res = await fetchWithTimeout(topicUrl, { headers: HEADERS });
			const html = await res.text();
			const $ = cheerio.load(html);
			$('a[href^="/blog/"]').each((_, el) => {
				const href = $(el).attr("href") ?? "";
				// トピック一覧ページ自体へのリンクは除外する
				if (!href.startsWith("/blog/") || href.includes("/topic/")) return;
				const url = `https://cursor.com${href}`;
				urlToTopic.set(url, slug);
			});
		} catch (e) {
			console.warn(`Cursor topic 取得失敗: ${topicUrl}`, e.message);
		}
	}
	return urlToTopic;
}

/**
 * Cursor ブログの記事一覧を取得する。
 *
 * 取得フロー:
 * 1. sitemap.xml から /blog/ 配下の記事 URL を列挙
 * 2. トピックページからも URL を収集し、サイトマップ未収録の新着を補完
 * 3. 全 URL の記事ページに個別アクセスし、タイトル・公開日・カテゴリを取得
 *
 * 毎回全件取得している理由：差分取得だと既存記事の日付が誤ったまま残り、
 * 新着が正しい順序で並ばなくなるため。
 */
export async function scrapeCursor() {
	const sitemapRes = await fetchWithTimeout("https://cursor.com/sitemap.xml", {
		headers: HEADERS,
	});
	const sitemapXml = await sitemapRes.text();

	// サイトマップから /blog/ 配下かつトピックページでない URL を抽出する
	const fromSitemap = [
		...sitemapXml.matchAll(
			/<loc>(https:\/\/cursor\.com\/blog\/(?!topic\/)[^<]+)<\/loc>/g,
		),
	].map((m) => m[1]);

	// サイトマップ未収録の新着を補完するため、トピックページからも URL を収集して合算する
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

			const title = $("h1").first().text().trim();
			const datetime = extractPublishedDate($);

			// カテゴリの決定：トピックページ由来なら slug から生成、それ以外はページ内リンクから抽出
			let category = "Blog";
			if (urlToTopic.has(url)) {
				const topic = urlToTopic.get(url);
				category = topic.charAt(0).toUpperCase() + topic.slice(1); // 例: 'product' → 'Product'
			} else {
				const topicLink = $('a[href^="/blog/topic/"]').first().attr("href");
				if (topicLink) {
					const match = topicLink.match(/\/blog\/topic\/([^/]+)/);
					if (match) {
						const topic = match[1];
						category = topic.charAt(0).toUpperCase() + topic.slice(1);
					}
				}
			}

			if (!title) continue; // タイトルが取れない場合はスキップ
			articles.push({
				title,
				link: url,
				date: datetime,
				source: "Cursor",
				category,
			});
		} catch (e) {
			console.warn(`Cursor記事取得失敗: ${url}`, e.message);
		}
	}

	return articles;
}

/**
 * 全ソース（OpenAI・Claude・Cursor）の記事を並行取得してまとめて返す。
 *
 * - Promise.allSettled を使うことで、一部のソースが失敗しても他のソースの結果を返せる
 * - URL の重複除去（同一記事が複数ソースで取得された場合）
 * - 日付降順ソート（日付なしは末尾）
 */
export async function fetchAllFeeds() {
	const results = await Promise.allSettled([
		fetchOpenAINews(),
		scrapeClaudeBlog("claude-code", "Claude Code"),
		scrapeClaudeBlog("agents", "Agents"),
		scrapeClaudeBlog("announcements", "Product Announcements"),
		scrapeClaudeBlog("enterprise-ai", "Enterprise AI"),
		scrapeCursor(),
	]);

	const articles = results.flatMap((r) =>
		r.status === "fulfilled" ? r.value : [],
	);

	// 同一 URL の記事を除去する（複数カテゴリに同じ記事が登録されるケースへの対応）
	const seen = new Set();
	const unique = articles.filter((a) => {
		if (!a.link || seen.has(a.link)) return false;
		seen.add(a.link);
		return true;
	});

	// 日付降順ソート。日付なし記事は末尾に置く
	unique.sort((a, b) => {
		if (!a.date) return 1;
		if (!b.date) return -1;
		return new Date(b.date) - new Date(a.date);
	});

	return { updatedAt: new Date().toISOString(), articles: unique };
}

/**
 * 記事タイトルを DeepL API で日本語に翻訳し、titleJa フィールドを追加して返す。
 *
 * - DEEPL_API_KEY が未設定の場合はスキップして元の配列をそのまま返す
 * - DeepL 無料枠は1リクエスト最大50件のため、50件ずつチャンク送信する
 * - API エラー時は翻訳なしで元の配列を返す（部分的な翻訳結果を混在させないため）
 */
export async function translateTitles(articles) {
	const apiKey = process.env.DEEPL_API_KEY;
	if (!apiKey) {
		console.warn("DEEPL_API_KEY not set, skipping translation.");
		return articles;
	}

	const titles = articles.map((a) => a.title);
	const translated = [];

	for (let i = 0; i < titles.length; i += 50) {
		const chunk = titles.slice(i, i + 50);
		const res = await fetchWithTimeout(
			"https://api-free.deepl.com/v2/translate",
			{
				method: "POST",
				headers: {
					Authorization: `DeepL-Auth-Key ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: chunk,
					target_lang: "JA",
					source_lang: "EN",
				}),
			},
		);

		if (!res.ok) {
			// エラー時は翻訳なしで元配列を返す（中途半端な状態にしない）
			console.error("DeepL API error:", res.status, await res.text());
			return articles;
		}

		const data = await res.json();
		translated.push(...data.translations.map((t) => t.text));
	}

	return articles.map((a, i) => ({ ...a, titleJa: translated[i] }));
}
