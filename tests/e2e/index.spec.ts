import { test } from '@playwright/test';

// フェーズ1: アウトライン（test.todo のみ）
// Playwright では it ではなく test を使う

test.describe('初期表示', () => {
  test.describe('ページを開いた直後から全ソースの最新50件が閲覧できること', () => {
    test.skip('記事カードが表示されていること', async () => {});
    test.skip('取得件数が表示されていること', async () => {});
    test.skip('ページネーションが表示されていること', async () => {});
  });
});

test.describe('ソースフィルター', () => {
  test.describe('ソースボタンで記事を絞り込めること', () => {
    test.skip('OpenAI ボタンをクリックすると OpenAI の記事だけが表示されること', async () => {});
    test.skip('Claude ボタンをクリックすると Claude の記事だけが表示されること', async () => {});
    test.skip('Cursor ボタンをクリックすると Cursor の記事だけが表示されること', async () => {});
    test.skip('All ボタンをクリックすると全ソースの記事が表示されること', async () => {});
  });

  test.describe('現在選択中のソースが視覚的に一目でわかること', () => {
    test.skip('選択中のボタンだけがアクティブ状態になること', async () => {});
  });
});

test.describe('キーワード検索', () => {
  test.describe('キーワードで記事を絞り込めること', () => {
    test.skip('キーワードを入力すると一致する記事だけが表示されること', async () => {});
    test.skip('一致しないキーワードを入力すると記事が表示されないこと', async () => {});
    test.skip('検索をクリアすると全件表示に戻ること', async () => {});
  });

  test.describe('検索結果はページをまたいで全件表示されること', () => {
    test.skip('キーワード入力中はページネーションが表示されず全件が一覧されること', async () => {});
  });
});

test.describe('ページネーション', () => {
  test.describe('複数ページの記事を閲覧できること', () => {
    test.skip('次ページボタンをクリックすると次のページの記事が表示されること', async () => {});
    test.skip('前ページボタンをクリックすると前のページの記事が表示されること', async () => {});
    test.skip('先頭ページでは前ページボタンが無効になっていること', async () => {});
    test.skip('最終ページでは次ページボタンが無効になっていること', async () => {});
  });
});
