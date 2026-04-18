# AI Tech Feeds

OpenAI・Claude・Cursor の技術ブログを収集して一覧表示する静的Webアプリ。

## 収集対象

| ソース | カテゴリ |
|--------|----------|
| OpenAI | Product / Research |
| Claude | Claude Code / Agents / Product Announcements / Enterprise AI |
| Cursor | Product / Research |

## 仕組み

- **Astro** でビルド時にRSS取得・スクレイピングを実行し静的HTMLを生成
- **GitHub Actions** が毎日 JST 9:00 に自動ビルド＆デプロイ
- **GitHub Pages** でホスティング

## 開発

```bash
pnpm install
pnpm dev      # 開発サーバー起動
pnpm build    # 本番ビルド
```
