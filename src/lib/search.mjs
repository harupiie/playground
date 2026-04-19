// カタカナ→ひらがな変換 + 小文字化で、表記ゆれを吸収した検索用文字列を返す
export function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[\u30A1-\u30F6]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60),
    );
}

export function matchesQuery(article, query) {
  if (!query) return true;
  const q = normalize(query);
  return (
    normalize(article.title).includes(q) ||
    normalize(article.titleJa ?? "").includes(q)
  );
}
