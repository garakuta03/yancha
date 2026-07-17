# Codex 指示書 — Task 8: `upload` ステージ（Issue #27 / P0-8）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 8 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §4.4・§4.5・§4.6・§5.8

## なぜこれをやるか / 位置づけ

`checks` ステージ（Task 7 / #26）を通過した動画を、限定公開でYouTubeへ実際にアップロードする最終自動化ステージ。
これが通れば `theme → scene → audio → visual → video → metadata → checks → upload → review` の
自動化パートが完成し、残るは `review`（Task 9 / #28。人間ゲート＋E2E通し）のみになる。

**依存: Task 7（#26）の checks 通過。** Task 7 が `checks.json` を生成し、fail時にパイプラインを
止める前提がある上で、このステージは `checks.json` が既にpassしていることを前提にできる
（`upload` 自身は checks の再判定をしない）。

YouTube Data API v3 の `videos.insert` は **OAuth2 必須**（APIキーでは不可）。かつ **Content ID
クレームの有無はAPI経由で確認できない**ことが設計 §5.8 で裏取り済み。この2点が本タスクの難所であり、
「APIでできないことを実装しようとしない」姿勢が重要になる。

## スコープ

- **やる**:
  - `AppConfig` への OAuth2 env 追加（`src/config.ts`）
  - `pnpm pipeline auth` サブコマンド（`src/auth.ts`, `src/cli.ts`）
  - `buildUploadBody` 純関数（`src/clients/youtube.ts`）とその単体テスト
  - resumable upload の実装（`src/clients/youtube.ts`）
  - `UploadStage`（`src/stages/upload.ts`）と `--dry-run`
  - `.env.example` への追記（同意画面を本番公開にする旨の警告コメント含む）
- **やらない**:
  - Content ID クレームの取得（API不可。確定済み。下記参照）
  - クォータ節約ロジック（設計 §4.5。旧クォータ情報は前提にしない）
  - `publishAt` 予約投稿・公開状態への切替（フェーズ1）
  - サムネイル画像のアップロード（`thumbnails.set`。P0スコープ外）
  - `review` ステージの実装（Task 9）

## 現状（変更の起点）

- `src/config.ts`: `AppConfig` は `llm` / `comfyuiBaseUrl` / `ffmpegPath` のみ。**YouTube upload用の
  設定は存在しない。**
- `packages/research/src/youtube.ts`: `YOUTUBE_API_KEY` を使うAPIキー方式のクライアント（`createYoutubeClient`）。
  **これは公開データ読取専用（`channels.list` / `search.list` / `videos.list` 等）で、OAuth2 とは別物。**
  `getJson` が「素の `fetch` ＋ 非200は `YanchaError("CLIENT_ERROR", ...)`」というパターンを示しており、
  今回のYouTube upload用クライアントもこの形（素のfetch・`YanchaError`・`fetchImpl` 差し替え）を踏襲する。
  **ただし `YOUTUBE_API_KEY` と今回追加する OAuth2 の3変数は完全に別系統。混ぜない。**
- `src/clients/llm.ts`: Task 0 完了後の `LlmClient` パターン（`fetchFn` 注入・`YanchaError`）を踏襲する。
- `src/types/pipeline.ts`: 現状は旧 `StageId`（`script`/`narration`/`music`/`audioMix`/`humanReview`/`publish`）。
  **本タスクの実装時点では Task 1（#20）で新 `StageId`
  （`theme | scene | audio | visual | video | metadata | checks | upload | review`）に置き換わっている前提**
  で書く。`upload` はこの新 union の一員。
- `src/license.ts`: `writeLicenseJson` は現状**全上書き**。Task 1（#20）で `appendLicenseEntry` に
  置き換わっている前提。本タスクは `appendLicenseEntry(videoDir, entry)` を呼ぶ。
- `src/paths.ts`: 現状 `uploadJson` は存在しない。Task 1 で `resolveVideoPaths` に追加されている前提
  （`uploadJson: resolve(videoDir, "upload.json")`）。

## Global Constraints（計画・設計から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示。
- **コメント・ログ・エラーメッセージは日本語。**
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。
- テストは vitest（globals 有効）。**外部I/O（`fetch`）は差し替え可能にしてモック。テストで実際のAPIを叩かない。**
- `Math.random()` / `new Date()` の直接使用を禁止（決定論。時刻が必要な箇所は引数で注入する）。
- **`googleapis` npm は使わない。素の REST + `fetch`。認証のみ `google-auth-library` を使う**
  （設計 §4.6。理由: 実質 `videos.insert` 1本＋OAuthのみのために大きな依存ツリーを引き込む利得が薄い。
  既存 `LlmClient` / `packages/research` も素の `fetch` であり一貫させる）。
- **`containsSyntheticMedia` は常時ON**（設計 §5.8。P0の内容は開示"不要"側の可能性が高いが、
  上位設計の「AI開示トグルは常にON」原則を維持する。安全側に倒すコストがゼロのため）。
- **`--dry-run` を必ず用意する**（設計 §4.4。YouTubeチャンネルは未開設のため、upload以外のE2Eを
  先に完成させる必要がある）。
- **Content IDクレームの取得は実装しない**（API不可。確定済み。下記参照）。
- **クォータ節約ロジックを書かない**（設計 §4.5。`videos.insert` は1コール=1ユニット・専用バケット・
  既定100本/日。P0は5〜10本。旧情報「1600ユニット＝1日6本」は2度の改定で失効済みのため前提にしない）。
- コミットは日本語 `prefix: 要約`。`#27` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

```typescript
// src/clients/youtube.ts

// metadata.json から videos.insert のリクエストボディを組み立てる純関数（テスト対象）
export function buildUploadBody(metadata: MetadataData): UploadRequestBody;

export interface UploadRequestBody {
  readonly snippet: {
    readonly title: string;
    readonly description: string;
    readonly tags: readonly string[];
    readonly categoryId: string;
  };
  readonly status: {
    readonly privacyStatus: "unlisted";        // 常にunlisted。P0は限定公開で止める
    readonly containsSyntheticMedia: true;     // AI開示。常時ON（設計§5.8）
    readonly selfDeclaredMadeForKids: false;   // 開示フラグとは別物。混同しない
  };
}
```

`MetadataData` は Task 6（#25）で `src/stages/metadata.ts` に定義される想定の型
（タイトル・説明・タグ・サムネ案を持つ）。本タスクでは `title` / `description` / `tags` のみ使う。

## Step 1: config に OAuth2 設定を追加

`src/config.ts` の `AppConfig` に以下を追加する（`research` の `YOUTUBE_API_KEY` とは別物。混ぜない）:

```typescript
export interface AppConfig {
  // ...既存...
  readonly youtube: {
    readonly clientId?: string;
    readonly clientSecret?: string;
    readonly refreshToken?: string;
  };
}
```

- 対応する env: `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN`。
- `loadConfig` では **`auth` サブコマンド実行時は `refreshToken` が無くてもエラーにしない**
  （まさにこれを取得するためのコマンドのため）。`upload` ステージ実行時（`--dry-run` を除く）に
  未設定なら `YanchaError("CONFIG_MISSING", ...)` で落とす、という判定は `UploadStage` 側（Step 5）で行う。
  `loadConfig` 自体は既存の `llm` と同様「値があれば詰める」だけにして、必須チェックはステージ側に置く
  （`auth` コマンドが `loadConfig` を通る以上、ここで必須化すると `auth` が動かなくなるため）。
- `.env.example` に3変数を追記し、**コメントで「同意画面は必ず本番公開(In production)にすること。
  テストモードのままだと refresh token が7日で失効する」と警告する**（Step 5 参照）。

## Step 2: `pnpm pipeline auth` で refresh token を取得

`src/auth.ts`（新規）:

- 依存追加: `google-auth-library`（pnpm workspace のルートに追加。認証のみここで使う。アップロード本体には使わない）。
- スコープは **`https://www.googleapis.com/auth/youtube.upload` のみ**（最小権限。`youtube` スコープは
  アカウント管理全般を含み広すぎるため使わない）。
- **redirect_uri は `http://127.0.0.1:<port>`**（ローカルループバック）。`node:http` で一時サーバーを立てて
  認可コードのリダイレクトを受け取る。
  - ⚠️ **OOB（`urn:ietf:wg:oauth:2.0:oob`）は2023-01-31に完全廃止済み**。使わない。
  - カスタムURIスキーム（`com.example.app:/oauth2redirect` 等）も不可。CLIである以上ローカルHTTPサーバーが
    現実的な唯一の選択肢。
- `access_type=offline` + `prompt=consent` を指定して認可URLを組み立てる（`prompt=consent` を付けないと
  2回目以降の認可で refresh token が返らないことがあるため必須）。
- フロー:
  1. 認可URLをコンソールに出力し、ユーザーがブラウザで開いて許可する
  2. ローカルサーバーが認可コードを受け取る
  3. 認可コードをトークンエンドポイントに交換し、refresh token を取得
  4. **取得した refresh token を標準出力に出すだけ**（`.env` への書込みはしない。ユーザーが手で貼る。
     理由: `.env` の自動書換えは意図しない上書き・秘密情報のログ露出リスクがあるため、人間の目を挟む）
- `src/cli.ts` に `auth` サブコマンドを追加する:
  ```typescript
  if (command === "auth") {
    await runAuthFlow(config);
    return;
  }
  ```

## Step 3: `buildUploadBody` 純関数（テスト対象）

`src/clients/youtube.ts`（新規）:

```typescript
export function buildUploadBody(metadata: MetadataData): UploadRequestBody {
  return {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: "22" // People & Blogs。P0は固定値でよい（カテゴリ選定はフェーズ1の壁打ち事項）
    },
    status: {
      privacyStatus: "unlisted",
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false
    }
  };
}
```

- **`privacyStatus` は常に `"unlisted"`**（`ThemeData` や metadata から可変にしない。P0の動画は全て
  限定公開で止める方針のため、この関数のシグネチャに公開状態を渡す余地を作らない）。
- **`containsSyntheticMedia` は常に `true`。`selfDeclaredMadeForKids` は常に `false`。**
  両方 `status` 配下だが独立した別概念（子供向け宣言はAI開示と無関係）。混同しない。
- `categoryId` は固定値でよい（動的にする必要なし。YAGNI）。

**テスト（`tests/uploadBody.test.ts`）**:
- [ ] 任意の `MetadataData` を渡しても `status.containsSyntheticMedia === true` になること
- [ ] 任意の `MetadataData` を渡しても `status.privacyStatus === "unlisted"` になること
- [ ] `status.selfDeclaredMadeForKids === false` になること
- [ ] `snippet.title` / `description` / `tags` が入力の値をそのまま反映すること

## Step 4: resumable upload で `videos.insert`

`src/clients/youtube.ts` に以下を実装する（素の `fetch`。`fetchFn` を注入可能にしてテストでモックする —
Task 0 の `LlmClient` と同じパターン）:

```typescript
export interface YoutubeUploadClient {
  uploadVideo(opts: {
    readonly accessToken: string;
    readonly body: UploadRequestBody;
    readonly videoFilePath: string;
  }): Promise<{ readonly videoId: string; readonly url: string }>;
}

export function createYoutubeUploadClient(fetchFn?: typeof fetch): YoutubeUploadClient;
```

手順:
1. **セッション開始**:
   `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
   ヘッダに `Authorization: Bearer <accessToken>` と `X-Upload-Content-Type: video/mp4`、
   ボディに `buildUploadBody` の結果をJSONで送る。非200・`Location` ヘッダ欠如は
   `YanchaError("CLIENT_ERROR", ...)`。
2. **本体アップロード**: 応答の `Location` ヘッダのURLへ `PUT` で動画ファイル本体を送る。
3. 応答から `id`（videoId）を取り出し、`https://www.youtube.com/watch?v=<id>` の限定公開URLを組み立てる。
4. アクセストークンの取得（refresh token → access token 交換）も `google-auth-library` で行う
   （`src/auth.ts` と同じOAuthクライアント設定を再利用してよい）。

- **`accessToken` はこの関数の外（`UploadStage` 側）で用意し、注入する**。クライアント自体はOAuthの
  トークン更新ロジックを持たず、渡されたトークンで1回アップロードするだけの薄い層にする（テストしやすくするため）。

## Step 5: `UploadStage`

`src/stages/upload.ts`（新規）:

- 入力: `final.mp4`（Task 5 / #23）, `metadata.json`（Task 6 / #25）, `checks.json`（Task 7 / #26。
  存在確認のみ。中身の再判定はしない — Task 7 が既にfailで止めている前提）。
- `buildUploadBody(metadata)` でボディを組み立てる。
- **`--dry-run` の場合**: リクエストボディを `upload.json` に書いて終わる（YouTube APIを一切呼ばない）。
  これにより **チャンネル未開設でもE2Eを完成させられる**（設計 §4.4）。
- **`--dry-run` でない場合**:
  - `config.youtube` の3変数が揃っていなければ `YanchaError("CONFIG_MISSING", "YouTube upload用の
    OAuth2設定(YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET/YOUTUBE_REFRESH_TOKEN)が未設定です。
    先に pnpm pipeline auth で取得してください。")` を投げる。
  - refresh token から access token を取得し、`createYoutubeUploadClient().uploadVideo(...)` を呼ぶ。
  - 結果（`videoId` / `url` / レスポンス概要）を `upload.json` に書く。
  - `appendLicenseEntry(videoDir, { assetType: "metadata", ... })` … ではなく、`upload` 自体はライセンス
    証跡の対象外（アップロードは著作物の生成ではない）。**license.json への追記はしない。**
- `--dry-run` フラグは `src/cli.ts` の `pipeline` / `stage` コマンドに `--dry-run` オプションとして追加し、
  `PipelineContext` 経由で `UploadStage` に渡す（`PipelineContext` への `dryRun?: boolean` 追加は
  Task 1 のスコープと衝突しないよう、既存の `PipelineContext` 定義に素直にオプショナルフィールドを足す）。

## Content ID クレーム取得は実装しない（確定・重要）

**YouTube Data API v3 に Content ID クレームを報告するフィールドは存在しない。** Content ID API は
パートナー限定で一般開発者は使えない。代用候補（`contentDetails.licensedContent` / `status.license` /
`suggestions` part）は全て意味が異なり代用にならないことが設計 §5.8 で裏取り済み。さらに Content ID
クレームは動画を拒否せず収益化を横取りするだけなので `uploadStatus` は `processed` のままになり、
**API経由では成功と区別がつかない**。

→ **`upload.json` にクレーム情報を書くフィールドを作らない。** `review.md`（Task 9 / #28）側の
人間の手動確認チェックリストに「YouTube Studio で Content IDクレームの有無を目視確認」として落とす
（本タスクでは `review.md` は書かないが、`upload.json` の構造がそれを前提にしていることを意識する）。

## クォータ節約ロジックを書かない（確定・重要）

`videos.insert` は1コール=1ユニット・専用バケット・既定100本/日（設計 §4.5）。P0は5〜10本のため
工数を割かない。**旧情報「1600ユニット＝1日6本」は2025-12-04と2026-06-01の2度の改定で失効済み**。
この旧情報を前提にしたレート制限・リトライ抑制・バッチ化などのロジックを新規に書かないこと。

## Step 6: 同意画面の本番公開切替と7日後の生存確認（実装ではなく運用作業）

これはコードの変更ではなく、Codexの作業ログ／PRの説明にチェックリストとして残すこと:

- [ ] ⚠️ **Google Cloud の OAuth同意画面を「In production」に切り替える**（手作業）。
      これを忘れると refresh token が **7日で失効**し、パイプラインが週次で沈黙する（設計 §8 リスク3）。
      `youtube.upload` は機微スコープだが、**利用者が本人だけなら審査は不要**（公式に例外明記）。
      未確認アプリの警告は初回ブラウザ認可時に手動で通過すればよい。
- [ ] ⚠️ **実装から7日以上おいて、再認証なしでアップロードできるか実地確認する。**
      「本番公開にすれば7日失効が消える」ことの**公式明記は取れていない**（コミュニティ報告は一致するが
      確証度が一段低い。設計 §8 リスク3）。失効していた場合は設計 §8 リスク3 を更新すること。

## 完了の定義

- [ ] `buildUploadBody` のテストで `containsSyntheticMedia` が必ず `true`、`privacyStatus` が必ず
      `"unlisted"` になることを確認している
- [ ] `pnpm build`（`tsc --noEmit`）が通る
- [ ] `pnpm test` が通る（`fetchFn` 注入で実APIを叩かないことを含む）
- [ ] `--dry-run` で `upload.json` が書かれ、YouTube APIを呼ばないことを確認している
- [ ] `pnpm pipeline auth` が refresh token を標準出力に表示し、`.env` を自動書換えしないことを確認している
- [ ] Content IDクレームの取得ロジックを実装していない（`upload.json` にクレーム系フィールドがない）
- [ ] クォータ節約ロジック（レート制限・バッチ化等）を新規に書いていない
- [ ] `Math.random()` / `new Date()` を新規に使っていない
- [ ] 同意画面の本番公開切替・7日後の生存確認をチェックリストとして作業ログ／PR説明に残している
- [ ] コミットメッセージが日本語で `#27` を紐付けている
