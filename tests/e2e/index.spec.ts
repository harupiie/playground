import { test, expect } from '@playwright/test';

test.describe('初期表示', () => {
  test.describe('ページを開いた直後から全ソースの最新50件が閲覧できること', () => {
    test('記事カードが表示されていること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(50);
    });

    test('取得件数が表示されていること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Assert
      await expect(page.locator('#shown-count')).toHaveText('1–50 / 55');
    });

    test('ページネーションが表示されていること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Assert
      await expect(page.locator('#pagination-bottom .page-btn').first()).toBeVisible();
    });
  });
});

test.describe('ソースフィルター', () => {
  test.describe('ソースボタンで記事を絞り込めること', () => {
    test('OpenAI ボタンをクリックすると OpenAI の記事だけが表示されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Act
      await page.click('.filter-btn[data-source="OpenAI"]');

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(20);
      await expect(page.locator('.article-card[data-source="OpenAI"]:visible')).toHaveCount(20);
    });

    test('Claude ボタンをクリックすると Claude の記事だけが表示されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Act
      await page.click('.filter-btn[data-source="Claude"]');

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(20);
      await expect(page.locator('.article-card[data-source="Claude"]:visible')).toHaveCount(20);
    });

    test('Cursor ボタンをクリックすると Cursor の記事だけが表示されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Act
      await page.click('.filter-btn[data-source="Cursor"]');

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(15);
      await expect(page.locator('.article-card[data-source="Cursor"]:visible')).toHaveCount(15);
    });

    test('All ボタンをクリックすると全ソースの記事が表示されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');
      await page.click('.filter-btn[data-source="OpenAI"]');

      // Act
      await page.click('.filter-btn[data-source="All"]');

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(50);
    });
  });

  test.describe('現在選択中のソースが視覚的に一目でわかること', () => {
    test('選択中のボタンだけがアクティブ状態になること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Act
      await page.click('.filter-btn[data-source="OpenAI"]');

      // Assert
      await expect(page.locator('.filter-btn--active')).toHaveCount(1);
      await expect(page.locator('.filter-btn--active')).toHaveAttribute('data-source', 'OpenAI');
    });
  });
});

test.describe('キーワード検索', () => {
  test.describe('キーワードで記事を絞り込めること', () => {
    test('キーワードを入力すると一致する記事だけが表示されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');
      const keyword = 'Playwright E2E Search Target';

      // Act
      await page.fill('#search', keyword);

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(1);
    });

    test('一致しないキーワードを入力すると記事が表示されないこと', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');
      const keyword = 'xyznonexistentarticle';

      // Act
      await page.fill('#search', keyword);

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(0);
    });

    test('検索をクリアすると全件表示に戻ること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');
      await page.fill('#search', 'Playwright E2E Search Target');

      // Act
      await page.fill('#search', '');

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(50);
    });
  });

  test.describe('検索結果はページをまたいで全件表示されること', () => {
    test('キーワード入力中はページネーションが表示されず全件が一覧されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Act
      await page.fill('#search', 'Playwright E2E Search Target');

      // Assert
      await expect(page.locator('#pagination-bottom')).not.toBeVisible();
      await expect(page.locator('.article-card:visible')).toHaveCount(1);
    });
  });
});

test.describe('ページネーション', () => {
  test.describe('複数ページの記事を閲覧できること', () => {
    test('次ページボタンをクリックすると次のページの記事が表示されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Act
      await page.locator('#pagination-bottom .page-nav').last().click();

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(5);
      await expect(page.locator('#shown-count')).toHaveText('51–55 / 55');
    });

    test('前ページボタンをクリックすると前のページの記事が表示されること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');
      await page.locator('#pagination-bottom .page-nav').last().click();

      // Act
      await page.locator('#pagination-bottom .page-nav').first().click();

      // Assert
      await expect(page.locator('.article-card:visible')).toHaveCount(50);
      await expect(page.locator('#shown-count')).toHaveText('1–50 / 55');
    });

    test('先頭ページでは前ページボタンが無効になっていること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');

      // Assert
      await expect(page.locator('#pagination-bottom .page-nav').first()).toBeDisabled();
    });

    test('最終ページでは次ページボタンが無効になっていること', async ({ page }) => {
      // Arrange
      await page.goto('/playground/');
      await page.locator('#pagination-bottom .page-nav').last().click();

      // Assert
      await expect(page.locator('#pagination-bottom .page-nav').last()).toBeDisabled();
    });
  });
});
