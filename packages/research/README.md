# @yancha/research

手動シードした競合チャンネルをコマンド駆動でスナップショット取得し、経過時間で正規化したエッジ指標をローカルWebビューで確認する。常駐しない。

## 前提

- `YOUTUBE_API_KEY` を `.env` または環境変数に設定する。
- 公式 YouTube Data API v3 のみを使う。
- `search.list` は使わない。`channels.list` / `playlistItems.list` / `videos.list` の1ユニット系APIだけを使う。

## 使い方

```bash
pnpm research add <channel_url|channel_id> "メモ"
pnpm research collect
pnpm research serve
```

パッケージを直接指定する場合:

```bash
pnpm --filter @yancha/research research add <channel_url|channel_id> "メモ"
pnpm --filter @yancha/research research collect
pnpm --filter @yancha/research research serve
```

`serve` は `http://localhost:5177` を起動する。判定は人間が行い、Webビューは指標を提示するだけ。
