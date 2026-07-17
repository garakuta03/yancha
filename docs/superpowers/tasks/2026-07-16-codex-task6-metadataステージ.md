# Codex 指示書 — Task 6: `metadata` ステージ（Issue #25 / P0-6）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 6 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §3.2・§4.2 /
> 上位設計: [ノーボイス全生成・VPS配信基盤設計](../../design/2026-07-16-ノーボイス全生成・vps配信基盤設計.md) §6.1

## なぜこれをやるか

`metadata` ステージは `scene.json` を読み、YouTubeに投稿する動画のタイトル・説明・タグ・
サムネ案テキストをLLMで生成する。ここで作る `metadata.json` は次の2ステージ（`checks` /
`upload`）の直接の入力になる。

- `checks`（Task 7 / #26）は `metadata.json` の title/description/tags に効能表現リンター
  （`policy.ts`）を適用する。
- `upload`（Task 8 / #28）は `metadata.json` から `videos.insert` のリクエストボディを組む。

さらに、上位設計 §6.1「固有性の機械的保証」は次を要求している（審査シグナル対策）：

> メタデータも非テンプレ化: タイトルの連番テンプレ（"〇〇 Mix #47"型）・同一構造の説明文の
> 連発を避ける（審査シグナルとして指摘されている）。

`metadata` ステージが**LLMに丸投げでテンプレ文を吐かせる**と、この原則が実装レベルで崩れる。
説明欄に `scene.json` の `storyline`（世界観の短文）を含めることと、プロンプトに非テンプレ化の
指示を明示することが、この原則を担保する具体的な手段になる。

## スコープ

- **やる**: `src/stages/metadata.ts`（`MetadataStage`）・`src/stages/metadataPrompt.ts`（プロンプト）の新規作成。
  `MetadataData` 型とその純関数バリデータ `validateMetadata`。`tests/metadataStage.test.ts` の新規作成。
- **やらない**:
  - サムネ**画像**の生成（P0はテキストの案1つのみ。画像生成はフェーズ1）。
  - チャプター自動生成（フェーズ1。上位設計 §1 非ゴール表）。
  - サムネ案・タイトル案の複数生成（3案比較はフェーズ1。P0は1案のみ）。
  - `checks` ステージ側の実装（Task 7 / #26。ここでは触らない）。
  - `upload` ステージ側の実装（Task 8 / #28。リクエストボディ組み立てはそちら）。

## 依存

- **Task 0（LLMクライアント堅牢化・#19）**: `LlmClient.generateJson<T>` / `LlmGenerateRequest.responseFormat` /
  `extractJson` が前提。未マージなら先にそちらを完了させること。
- **Task 2（`scene` ステージ・#21）**: `scene.json` のスキーマ（`SceneData`、特に `storyline` /
  `title` フィールド）が前提。未マージなら `SceneData` の該当フィールドだけでも設計 §5.2 を見て
  合わせること。

## 現状（変更の起点）

このタスクの時点で、リポジトリは Task 0〜5 の変更が反映済みという前提で書く（本ドキュメント
執筆時点ではまだ未着手のため、現在の `main` とは差分がある点に注意）。

- `src/stages/script.ts`（削除予定・Task 1 Step 5）の形が転用元:
  `theme.json` 読込 → LLMプロンプト構築 → `llmClient.generate(...)` 呼び出し →
  成果物を `writeJson` → `appendLicenseEntry` で証跡追記、という一連の流れ。
  `metadata` ステージもこの形をそのまま踏襲する（LLM呼び出しが `generateJson` に変わる点のみ違う）。
- `src/clients/llm.ts`（Task 0 完了後）: `LlmClient` は
  `generate(request): Promise<LlmGenerateResponse>` に加え
  `generateJson<T>(request, validate: (value: unknown) => T): Promise<T>` を持つ。
  `LlmGenerateRequest.responseFormat?: "text" | "json"` で JSON モードを要求できる。
- `src/types/pipeline.ts`（Task 1 完了後）: `StageId` に `"metadata"` を含む。
  `MetadataData` はまだ定義されていない（このタスクで追加する）。
- `src/license.ts`（Task 1 Step 4 完了後）:
  `appendLicenseEntry(videoDir: string, entry: LicenseEntry): Promise<void>` が使える。
  `LicenseEntry.assetType` union に `"metadata"` を含む。
- `src/paths.ts`（Task 1 Step 8 完了後）: `resolveVideoPaths` に `sceneJson` / `metadataJson` が含まれる。
- `packages/core` の `readJson` / `writeJson` / `YanchaError` はそのまま使う。

## Global Constraints（計画から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示。
- **コメント・ログ・エラーメッセージは日本語。**
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。バリデーション失敗は
  `YanchaError("ARTIFACT_INVALID", ...)`（設計 §4.2 の流儀。`scene` と揃える）。
- テストは vitest（globals 有効）。外部I/O（`LlmClient`）は差し替え可能にしてモックする。
  **テストで実際のLLM APIを叩かない。**
- **`Math.random()` / `new Date()` の直接使用を禁止**（seed駆動・決定論。設計 §4.1）。
  `createdAt` 等の時刻は `context` や引数経由で注入するか、既存ステージの慣習（`new Date().toISOString()`）
  を踏襲するかは既存コードに倣うこと。ただし**新規のランダム性は絶対に持ち込まない**
  （タイトル・タグの非テンプレ化はプロンプト側の指示で担保し、コード側で乱数を混ぜて誤魔化さない）。
- **既定値へのフォールバックを絶対に入れない**（設計 §4.2）。LLMの出力がスキーマに合わなければ
  `validateMetadata` が投げ、それをそのまま伝播させて落とす。
- コミットは日本語 `prefix: 要約`。`#25` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

```typescript
// src/types/pipeline.ts に追加
export interface MetadataData {
  readonly title: string;
  readonly description: string;      // scene.json の storyline を含める
  readonly tags: readonly string[];
  readonly thumbnailIdea: string;     // サムネ案のテキスト1つ（画像は生成しない）
}
```

```typescript
// src/stages/metadata.ts に追加。純関数としてexportし単体テストする
export function validateMetadata(value: unknown): MetadataData;
```

```typescript
// src/stages/metadata.ts
export class MetadataStage implements StageRunner {
  readonly id = "metadata" as const;
  readonly outputFile = "metadata.json";
  constructor(private readonly llmClient: LlmClient) {}
  run(context: PipelineContext): Promise<StageArtifact<MetadataData>>;
}
```

```typescript
// src/stages/metadataPrompt.ts
export const metadataSystemPrompt: string;
export function buildMetadataPrompt(scene: SceneData): string;
```

---

## Step 1: `MetadataData` 型とバリデータ

`src/types/pipeline.ts` に `MetadataData` を追加する（上記インターフェース参照）。

`src/stages/metadata.ts` に `validateMetadata(value: unknown): MetadataData` を**純関数**で実装する。

- `title`: 空文字でない `string`。
- `description`: 空文字でない `string`。**`scene.json` の `storyline` を含んでいることまでは
  バリデータでは強制しない**（自由記述の中身を機械判定するのは過剰）。含める指示はプロンプト側
  （Step 2）で担保する。
- `tags`: `string` の配列。**空配列を許容しない**（最低1件）。各要素は空文字禁止。
- `thumbnailIdea`: 空文字でない `string`。
- 上記のいずれかが欠損・型不一致・空文字列の場合は
  `YanchaError("ARTIFACT_INVALID", "metadata.jsonの検証に失敗しました: <理由>")` を投げる。
  **理由は具体的に**（例: `"title が空文字です"` / `"tags が配列ではありません"`）。
- **フォールバックしない。** 例えば `tags` が空でも既定タグを補うようなことはしない（Global Constraints）。

`validateMetadata` はこのファイル内から `export` し、`tests/metadataStage.test.ts` から直接呼べる
純関数として書くこと（`scene` ステージの `validateScene` と同じ設計。設計 §5.2 / Task 2 Step 1 参照）。

## Step 2: プロンプトとステージ

### `src/stages/metadataPrompt.ts`

`scene.json`（`SceneData`）の内容から `MetadataData` を作らせるプロンプトを組み立てる。

- **`scene.storyline` を明示的にプロンプトへ渡し、「説明文に storyline の内容を反映させる」ことを
  指示する。** 上位設計 §6.1 の担保はここが要。
- **テンプレ化を避ける指示を必ず入れる**。具体的には次の禁止事項をプロンプトに明記する:
  - タイトルに連番・型番めいた記法（例: `〇〇 Mix #47`、`Vol.12` のような通し番号）を使わない。
  - 説明文を毎回同じ構造・同じ書き出しで書かない（他の動画と同一の定型文を繰り返さない）。
  - `scene.title` / `scene.storyline` の固有の情景描写を活かし、その回だけの説明にする。
- 出力スキーマ（`MetadataData` の各フィールドと型・制約）をプロンプト内に明示し、
  JSONのみを出力するよう指示する（実際のJSON強制は `generateJson` の `responseFormat: "json"` が担う。
  プロンプト側は形式の指示を重ねるだけで、JSONモード自体の実装はしない＝Task 0 の責務）。
- 効能断定表現（CLAUDE.md「絶対に守る原則」）を書かせない指示も入れる。
  「〇〇が治る」「不眠が解消する」等の断定は禁止し、「リラックス用」等の表現に限定するよう指示する。
  （機械的な最終防波堤は `checks` ステージの `policy.ts` が担うが、プロンプト側でも予防する。）

```typescript
export const metadataSystemPrompt = `あなたはYouTube動画のメタデータ作成者です。...`; // 日本語で執筆

export function buildMetadataPrompt(scene: SceneData): string {
  // scene.title / scene.storyline / scene.durationSeconds 等を埋め込み、
  // 出力スキーマとテンプレ化禁止・効能断定禁止の指示を含めたプロンプト文字列を返す
}
```

### `src/stages/metadata.ts` — `MetadataStage`

`script.ts`（転用元）の形を踏襲する:

1. `context.videoDir` から `scene.json`（`StageArtifact<SceneData>`）を `readJson` で読む。
2. `buildMetadataPrompt(sceneArtifact.data)` でプロンプトを組む。
3. `this.llmClient.generateJson<MetadataData>(
     { temperature: 0.7, responseFormat: "json",
       messages: [{ role: "system", content: metadataSystemPrompt }, { role: "user", content: prompt }] },
     validateMetadata
   )` を呼ぶ。**`generate` ではなく `generateJson` を使うこと。**
4. 結果を `StageArtifact<MetadataData>` として組み立て、`metadata.json`（`resolveVideoPaths` の
   `metadataJson`、既定 `outputFile = "metadata.json"`）へ `writeJson`。
5. `appendLicenseEntry(context.videoDir, { assetType: "metadata", tool: "LLM", provider, modelOrPlan, ... })`
   で証跡を追記する。**`writeLicenseJson` / `createInitialLicense` は使わない**（Task 1 で
   `appendLicenseEntry` に置き換え済みの前提）。`provider` / `modelOrPlan` は
   `LlmClient` の応答が持つ値をそのまま使う（`generateJson` の戻り値は `T` のみで
   provider/model を含まないため、必要なら `LlmGenerateResponse` を返す薄いラッパー経由にするか、
   `generateJson` 呼び出し前後で `config.llm.provider` / `config.llm.model` を直接参照する。
   **`script.ts` は `response.provider` を使っていたが、`generateJson` は検証済み値 `T` だけを返す
   契約のため、provider/model は `AppConfig` から取得する形に変える**）。
6. `validate` が投げた `YanchaError` はそのまま伝播させる（呼び出し元でキャッチしない。
   Global Constraints「既定値へのフォールバックを絶対に入れない」）。

## 完了の定義

- [ ] `validateMetadata` の純関数テスト（`tests/metadataStage.test.ts`）:
  - 正常系（全フィールドが揃ったJSON）が通ること。
  - `title` 欠損・空文字・`tags` が空配列・`tags` が配列でない・`description` 欠損・
    `thumbnailIdea` 欠損、それぞれで `YanchaError` が飛ぶこと（`code` が `ARTIFACT_INVALID` であることまで確認）。
- [ ] `MetadataStage.run` のテスト（モックの `LlmClient` を注入）:
  - `scene.json` を読み、`generateJson` に `responseFormat: "json"` 付きリクエストが渡ること。
  - 返った `MetadataData` が `metadata.json` に書き出されること。
  - `appendLicenseEntry` 相当の呼び出し（またはファイル追記結果）で `assetType: "metadata"` の
    エントリが記録されること。
  - `generateJson` 内の `validate` が失敗を投げるケースで、ステージが例外をそのまま伝播させ、
    フォールバックしないこと。
- [ ] `pnpm build`（`tsc --noEmit`）が通る。
- [ ] `pnpm test` が通る。
- [ ] テストが実際のLLM APIを叩かない（`LlmClient` をモックで差し替えて確認）。
- [ ] `Math.random()` / `new Date()` を新規に不必要な形で使っていない。
- [ ] コミットメッセージが日本語で `#25` を紐付けている。
</content>
