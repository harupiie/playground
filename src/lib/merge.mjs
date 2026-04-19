/**
 * 既存記事マップに最新取得結果を適用する。
 *
 * タイトルと日付を新しい取得結果で上書きする。
 * 記事のタイトル表記揺れや日付の誤りが後から修正された場合に追従できるようにするため。
 * 新規 URL はこの関数では追加しない（新着の追加は呼び出し側が担う）。
 *
 * @param {Map<string, object>} existingByUrl - URL をキーとした既存記事マップ
 * @param {object[]} freshArticles - 最新取得した記事の配列
 * @returns {Map<string, object>} 更新後の新しいマップ（元の Map は変更しない）
 */
export function applyUpdates(existingByUrl, freshArticles) {
	const result = new Map(existingByUrl);
	for (const a of freshArticles) {
		const prev = result.get(a.link);
		if (!prev) continue;
		result.set(a.link, {
			...prev,
			// 新しい取得結果が空の場合は既存値を維持する
			date: a.date ?? prev.date,
			title: a.title || prev.title,
		});
	}
	return result;
}

/**
 * 指定したエポック時刻より古い記事を除外する。
 *
 * 日付なし記事は除外しない。日付が取得できなかっただけで記事自体は有効なため。
 *
 * @param {object[]} articles - 記事の配列
 * @param {number} cutoffMs - 基準日時のエポックミリ秒。これより古い記事を除外する
 * @returns {object[]} フィルタ後の記事配列
 */
export function filterExpired(articles, cutoffMs) {
	return articles.filter((a) => {
		if (!a.date) return true;
		return new Date(a.date).getTime() > cutoffMs;
	});
}

/**
 * 記事を日付降順（新しい順）にソートした新しい配列を返す。
 *
 * 日付なし記事は末尾に置く。日付不明の記事より日付が明確な記事を優先して表示するため。
 *
 * @param {object[]} articles - 記事の配列
 * @returns {object[]} ソート済みの新しい配列（元の配列は変更しない）
 */
export function sortByDate(articles) {
	return [...articles].sort((a, b) => {
		if (!a.date) return 1;
		if (!b.date) return -1;
		return new Date(b.date) - new Date(a.date);
	});
}
