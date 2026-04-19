import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { findDatePublishedInJsonLd, extractPublishedDate } from '../src/lib/feeds.mjs';

describe('findDatePublishedInJsonLd', () => {
  describe('各社ブログの多様な JSON-LD 構造から公開日を取得できること', () => {
    it('フラットな構造（最も一般的なパターン）から公開日を取得できること', () => {
      // Arrange
      const node = { '@type': 'BlogPosting', datePublished: '2025-01-01' };

      // Act
      const result = findDatePublishedInJsonLd(node);

      // Assert
      assert.equal(result, '2025-01-01');
    });

    it('@graph でラップされた構造（1ページに複数エンティティを持つサイト）から公開日を取得できること', () => {
      // Arrange
      const node = {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'Acme' },
          { '@type': 'BlogPosting', datePublished: '2025-02-15' },
        ],
      };

      // Act
      const result = findDatePublishedInJsonLd(node);

      // Assert
      assert.equal(result, '2025-02-15');
    });

    it('深くネストされた構造から公開日を取得できること', () => {
      // Arrange
      const node = {
        mainEntity: {
          hasPart: {
            '@type': 'BlogPosting',
            datePublished: '2025-03-10',
          },
        },
      };

      // Act
      const result = findDatePublishedInJsonLd(node);

      // Assert
      assert.equal(result, '2025-03-10');
    });

    it('@type が配列で指定されているサイトでも公開日を取得できること', () => {
      // Arrange
      const node = { '@type': ['BlogPosting', 'Article'], datePublished: '2025-04-01' };

      // Act
      const result = findDatePublishedInJsonLd(node);

      // Assert
      assert.equal(result, '2025-04-01');
    });

    it('BlogPosting 以外の記事タイプ（Article・NewsArticle）にも対応していること', () => {
      // Arrange
      const article = { '@type': 'Article', datePublished: '2025-01-10' };
      const newsArticle = { '@type': 'NewsArticle', datePublished: '2025-01-20' };

      // Act
      const resultArticle = findDatePublishedInJsonLd(article);
      const resultNewsArticle = findDatePublishedInJsonLd(newsArticle);

      // Assert
      assert.equal(resultArticle, '2025-01-10');
      assert.equal(resultNewsArticle, '2025-01-20');
    });
  });

  describe('公開日が取得できない場合は null を返すこと', () => {
    it('対応する記事タイプ（BlogPosting 等）が含まれない JSON-LD の時、null を返すこと', () => {
      // Arrange
      const node = { '@type': 'Person', name: 'John', datePublished: '2025-01-01' };

      // Act
      const result = findDatePublishedInJsonLd(node);

      // Assert
      assert.equal(result, null);
    });

    it('記事タイプは存在するが datePublished がない時、null を返すこと', () => {
      // Arrange
      const node = { '@type': 'BlogPosting', headline: 'My Post' };

      // Act
      const result = findDatePublishedInJsonLd(node);

      // Assert
      assert.equal(result, null);
    });

    it('JSON-LD データ自体が存在しない（null）時、null を返すこと', () => {
      // Arrange
      const node = null;

      // Act
      const result = findDatePublishedInJsonLd(node);

      // Assert
      assert.equal(result, null);
    });
  });
});

describe('extractPublishedDate', () => {
  describe('記事ページから公開日を取得できること', () => {
    it('JSON-LD に公開日が含まれる時、その値を取得できること', () => {
      // Arrange
      const $ = cheerio.load(`
        <script type="application/ld+json">
          { "@type": "BlogPosting", "datePublished": "2025-01-01" }
        </script>
      `);

      // Act
      const result = extractPublishedDate($);

      // Assert
      assert.equal(result, '2025-01-01');
    });

    it('JSON-LD がない時、time タグの datetime 属性から公開日を取得できること', () => {
      // Arrange
      const $ = cheerio.load(`<time datetime="2025-02-15">Feb 15, 2025</time>`);

      // Act
      const result = extractPublishedDate($);

      // Assert
      assert.equal(result, '2025-02-15');
    });

    it('time タグに datetime 属性がない時、テキスト内容から公開日を取得できること', () => {
      // Arrange
      const $ = cheerio.load(`<time>March 10, 2025</time>`);

      // Act
      const result = extractPublishedDate($);

      // Assert
      assert.equal(result, 'March 10, 2025');
    });
  });

  describe('複数の手段が存在する場合は信頼性の高い情報を優先すること', () => {
    it('JSON-LD と time タグの両方がある時、JSON-LD の値を優先すること', () => {
      // Arrange
      const $ = cheerio.load(`
        <script type="application/ld+json">
          { "@type": "BlogPosting", "datePublished": "2025-01-01" }
        </script>
        <time datetime="1999-12-31">Dec 31, 1999</time>
      `);

      // Act
      const result = extractPublishedDate($);

      // Assert
      assert.equal(result, '2025-01-01');
    });

    it('JSON-LD のパースに失敗する時、time タグにフォールバックすること', () => {
      // Arrange
      const $ = cheerio.load(`
        <script type="application/ld+json">{ invalid json }</script>
        <time datetime="2025-04-01">April 1, 2025</time>
      `);

      // Act
      const result = extractPublishedDate($);

      // Assert
      assert.equal(result, '2025-04-01');
    });
  });

  describe('公開日情報が存在しない場合は null を返すこと', () => {
    it('JSON-LD も time タグも存在しない時、null を返すこと', () => {
      // Arrange
      const $ = cheerio.load(`<p>No date information here.</p>`);

      // Act
      const result = extractPublishedDate($);

      // Assert
      assert.equal(result, null);
    });
  });
});
