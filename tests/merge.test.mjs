import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyUpdates, filterExpired, sortByDate } from "../src/lib/merge.mjs";

describe("applyUpdates", () => {
	describe("再取得した記事情報で既存データを最新化できること", () => {
		it("既存記事のタイトルが新しい取得結果で上書きされること", () => {
			// Arrange
			const existing = new Map([
				[
					"https://example.com/a",
					{
						link: "https://example.com/a",
						title: "古いタイトル",
						date: "2025-01-01",
					},
				],
			]);
			const fresh = [
				{
					link: "https://example.com/a",
					title: "新しいタイトル",
					date: "2025-01-01",
				},
			];

			// Act
			const result = applyUpdates(existing, fresh);

			// Assert
			assert.equal(result.get("https://example.com/a").title, "新しいタイトル");
		});

		it("既存記事の日付が新しい取得結果で上書きされること", () => {
			// Arrange
			const existing = new Map([
				[
					"https://example.com/a",
					{
						link: "https://example.com/a",
						title: "タイトル",
						date: "2024-01-01",
					},
				],
			]);
			const fresh = [
				{
					link: "https://example.com/a",
					title: "タイトル",
					date: "2025-06-01",
				},
			];

			// Act
			const result = applyUpdates(existing, fresh);

			// Assert
			assert.equal(result.get("https://example.com/a").date, "2025-06-01");
		});

		it("新しい取得結果のタイトルが空の時、既存のタイトルが維持されること", () => {
			// Arrange
			const existing = new Map([
				[
					"https://example.com/a",
					{
						link: "https://example.com/a",
						title: "既存タイトル",
						date: "2025-01-01",
					},
				],
			]);
			const fresh = [
				{ link: "https://example.com/a", title: "", date: "2025-01-01" },
			];

			// Act
			const result = applyUpdates(existing, fresh);

			// Assert
			assert.equal(result.get("https://example.com/a").title, "既存タイトル");
		});

		it("新しい取得結果の日付が null の時、既存の日付が維持されること", () => {
			// Arrange
			const existing = new Map([
				[
					"https://example.com/a",
					{
						link: "https://example.com/a",
						title: "タイトル",
						date: "2025-01-01",
					},
				],
			]);
			const fresh = [
				{ link: "https://example.com/a", title: "タイトル", date: null },
			];

			// Act
			const result = applyUpdates(existing, fresh);

			// Assert
			assert.equal(result.get("https://example.com/a").date, "2025-01-01");
		});
	});

	describe("呼び出し元のデータに影響を与えないこと", () => {
		it("渡した Map が変更されないこと", () => {
			// Arrange
			const existing = new Map([
				[
					"https://example.com/a",
					{
						link: "https://example.com/a",
						title: "古いタイトル",
						date: "2025-01-01",
					},
				],
			]);
			const fresh = [
				{
					link: "https://example.com/a",
					title: "新しいタイトル",
					date: "2025-01-01",
				},
			];

			// Act
			applyUpdates(existing, fresh);

			// Assert
			assert.equal(existing.get("https://example.com/a").title, "古いタイトル");
		});
	});

	describe("新規 URL の追加は呼び出し側が担うこと", () => {
		it("既存マップに存在しない URL の記事は追加されないこと", () => {
			// Arrange
			const existing = new Map([
				[
					"https://example.com/a",
					{
						link: "https://example.com/a",
						title: "タイトル",
						date: "2025-01-01",
					},
				],
			]);
			const fresh = [
				{
					link: "https://example.com/new",
					title: "新着記事",
					date: "2025-06-01",
				},
			];

			// Act
			const result = applyUpdates(existing, fresh);

			// Assert
			assert.equal(result.has("https://example.com/new"), false);
			assert.equal(result.size, 1);
		});
	});
});

describe("filterExpired", () => {
	describe("表示対象の記事のみを残せること", () => {
		it("基準日時より新しい記事は残ること", () => {
			// Arrange
			const cutoff = new Date("2025-01-01").getTime();
			const articles = [{ title: "新しい記事", date: "2025-06-01" }];

			// Act
			const result = filterExpired(articles, cutoff);

			// Assert
			assert.equal(result.length, 1);
		});

		it("基準日時より古い記事は除外されること", () => {
			// Arrange
			const cutoff = new Date("2025-01-01").getTime();
			const articles = [{ title: "古い記事", date: "2024-01-01" }];

			// Act
			const result = filterExpired(articles, cutoff);

			// Assert
			assert.equal(result.length, 0);
		});

		it("日付が取得できなかった記事は有効な記事として残ること", () => {
			// Arrange
			const cutoff = new Date("2025-01-01").getTime();
			const articles = [{ title: "日付なし記事", date: null }];

			// Act
			const result = filterExpired(articles, cutoff);

			// Assert
			assert.equal(result.length, 1);
		});
	});

	describe("呼び出し元のデータに影響を与えないこと", () => {
		it("渡した配列が変更されないこと", () => {
			// Arrange
			const cutoff = new Date("2025-01-01").getTime();
			const articles = [
				{ title: "新しい記事", date: "2025-06-01" },
				{ title: "古い記事", date: "2024-01-01" },
			];

			// Act
			filterExpired(articles, cutoff);

			// Assert
			assert.equal(articles.length, 2);
		});
	});
});

describe("sortByDate", () => {
	describe("新着順に記事を並べられること", () => {
		it("日付が新しい記事が先頭になること", () => {
			// Arrange
			const articles = [
				{ title: "古い記事", date: "2024-01-01" },
				{ title: "新しい記事", date: "2025-06-01" },
			];

			// Act
			const result = sortByDate(articles);

			// Assert
			assert.equal(result[0].title, "新しい記事");
		});

		it("日付が取得できなかった記事は日付明確な記事の後ろに表示されること", () => {
			// Arrange
			const articles = [
				{ title: "日付なし記事", date: null },
				{ title: "日付あり記事", date: "2025-01-01" },
			];

			// Act
			const result = sortByDate(articles);

			// Assert
			assert.equal(result[result.length - 1].title, "日付なし記事");
		});

		it("日付が同じ記事の並び順が一定であること", () => {
			// Arrange
			const articles = [
				{ title: "記事A", date: "2025-01-01" },
				{ title: "記事B", date: "2025-01-01" },
			];

			// Act
			const result = sortByDate(articles);

			// Assert
			assert.equal(result[0].title, "記事A");
			assert.equal(result[1].title, "記事B");
		});
	});

	describe("呼び出し元のデータに影響を与えないこと", () => {
		it("渡した配列が変更されないこと", () => {
			// Arrange
			const articles = [
				{ title: "古い記事", date: "2024-01-01" },
				{ title: "新しい記事", date: "2025-06-01" },
			];

			// Act
			sortByDate(articles);

			// Assert
			assert.equal(articles[0].title, "古い記事");
		});
	});
});
