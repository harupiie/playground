import { test } from '@playwright/test';

// フェーズ1: アウトライン（test.todo のみ）
// Playwright では it ではなく test を使う

test.describe('初期表示', () => {
  test.describe('ページを開いた時に記事一覧が使える状態であること', () => {
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

  test.describe('選択中のボタンが視覚的に区別できること', () => {
    test.skip('クリックしたボタンがアクティブ状態になること', async () => {});
    test.skip('他のボタンはアクティブ状態が解除されること', async () => {});
  });
});

test.describe('キーワード検索', () => {
  test.describe('キーワードで記事を絞り込めること', () => {
    test.skip('キーワードを入力すると一致する記事だけが表示されること', async () => {});
    test.skip('一致しないキーワードを入力すると記事が表示されないこと', async () => {});
    test.skip('検索をクリアすると全件表示に戻ること', async () => {});
  });

  test.describe('検索中はページネーションが非表示になること', () => {
    test.skip('キーワード入力中はページネーションが表示されないこと', async () => {});
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
