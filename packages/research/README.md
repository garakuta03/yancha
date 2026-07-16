# @yancha/research

手動シードした競合チャンネルをコマンド駆動でスナップショット取得し、経過時間で正規化したエッジ指標をローカルWebビューで確認する。常駐しない。

## 前提

- `YOUTUBE_API_KEY` を `.env` または環境変数に設定する。
- 公式 YouTube Data API v3 のみを使う。
- 手動台帳の定点観測は `channels.list` / `playlistItems.list` / `videos.list` の1ユニット系APIを使う。
- 発掘は `search.list` を1キーワード1回だけ使う（100ユニット/語、ページングなし）。

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

## 発掘（プランB/C）

```bash
# 初回だけ、YANCHA_RESEARCH_DIR 配下にキーワード台帳を用意する
cp packages/research/keywords.example.yaml research-data/keywords.yaml

pnpm --filter @yancha/research research discover
pnpm --filter @yancha/research research candidates
pnpm --filter @yancha/research research approve <channelId>
pnpm --filter @yancha/research research reject <channelId>
pnpm --filter @yancha/research research retire <channelId>
```

- 候補は自動で台帳に入らない。`approve` で人間が承認したものだけ昇格する。
- `discover` は見積りが `quotaGuardUnits` を超えると中断する。意図して続行する場合は `--yes` を付ける。
- `retire` した台帳エントリは行を残したまま、以後の `collect` 対象から除外される。
