import { defineConfig } from '@playwright/test';

/**
 * Playwright の設定。
 *
 * webServer を使わずにプレビューサーバーを globalSetup/globalTeardown で管理する理由:
 * Playwright は globalSetup と webServer を並行起動するため、globalSetup でビルドを行っても
 * ビルド完了前に webServer が起動してしまい、dist/ が存在しない状態で pnpm preview が失敗する。
 * サーバーのライフサイクルを globalSetup/globalTeardown に集約することで順序を保証する。
 *
 * base: '/playground' があるため baseURL はオリジンのみとし、テスト内で /playground/ を明示する。
 * page.goto('/') は '/' を絶対パスとして解釈するため subpath を持つ baseURL と組み合わせると
 * 意図しない URL に解決される。オリジンのみにしてパスをテスト側で指定するのが確実。
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup:    './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:4321',
  },
});
