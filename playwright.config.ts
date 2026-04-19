import { defineConfig } from '@playwright/test';

/**
 * Playwright の設定。
 *
 * webServer の役割:
 * - command でビルド → プレビューサーバー起動を直列実行する
 * - url でサーバーの準備完了を検知する（ポーリングで確認）
 * - reuseExistingServer: CI では常に新しくビルド、ローカルでは起動済みサーバーを再利用してビルド時間を節約
 *
 * base: '/playground' があるため baseURL にパスを含める。
 * page.goto('/') は http://localhost:4321/playground/ に解決される。
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup:    './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  use: {
    baseURL: 'http://localhost:4321/playground',
  },

  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4321/playground/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
