# yancha

AI睡眠/ヒーリング動画チャンネル用の制作パイプラインです。フェーズ0ではMac上で完結し、動画IDごとの成果物を `assets/<video_id>/` に保存します。

## 方針

- TypeScript strict + tsx
- パッケージマネージャは pnpm
- 各ステージはJSONメタデータで受け渡し
- 台本、音声、音楽、映像、メタデータのライセンス証跡を `license.json` に保存
- 投稿前の人間レビューは自動化しない

## セットアップ

```bash
npx pnpm@11.13.0 install
cp .env.example .env
```

Geminiでライブ生成する場合は `.env` に `GEMINI_API_KEY` を設定します。OpenAIへ切り替える場合は `YANCHA_LLM_PROVIDER=openai`、`YANCHA_LLM_MODEL`、`OPENAI_API_KEY` を設定します。

キーなしでローカル検証する場合:

```bash
YANCHA_LLM_PROVIDER=mock YANCHA_LLM_MODEL=local-mock npx pnpm@11.13.0 run stage:script -- sample-local
```

## 実行

台本生成まで:

```bash
npm run stage:script -- <video_id>
```

pnpmで実行する場合:

```bash
npx pnpm@11.13.0 run stage:script -- <video_id>
```

任意ステージだけ再実行:

```bash
npx pnpm@11.13.0 run stage -- script <video_id>
```

パイプライン全体:

```bash
npx pnpm@11.13.0 run pipeline -- --video-id <video_id>
```

## テスト

```bash
npx pnpm@11.13.0 test
```

## Docker

```bash
docker compose build
docker compose run --rm runner
```

GPU生成は将来対応です。フェーズ0ではComfyUIをホスト側で起動し、TypeScript側からHTTP APIで呼び出す前提です。
Geminiなどの実キーを使う場合は `.env` を作成してから `docker compose --env-file .env run --rm runner` を実行します。

## 主な構成

- `src/config.ts`: 環境変数ベースの設定
- `src/logger.ts`: 日本語ログ用のレベル付きロガー
- `src/errors.ts`: 共通の型付きエラー
- `src/clients/llm.ts`: Gemini/OpenAI/mock LLMクライアント
- `src/clients/stubs.ts`: TTS、音楽・環境音、ComfyUI、ffmpegのスタブ
- `src/stages/`: パイプラインステージ
- `src/orchestrator.ts`: ステージ直列実行
- `src/license.ts`: ライセンス証跡の型と書き出し
