# Codex 指示書 — Task 7: `checks` ステージ（Issue #26 / P0-7）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 7 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §5.6・§8 リスク6

## なぜこれをやるか / 位置づけ

P0のパイプラインは `theme → scene → audio → visual → video → metadata → checks → upload → review`
の順で進む。`checks` は**公開前の自動ゲート**であり、`video` が出した `final.mp4` と
`metadata` が出した `metadata.json` を検査し、**1つでもfailなら `upload` に進ませない**
（設計 §5.6）。人間レビュー（`review` ステージ）はこの自動ゲートを通過した後の最終防波堤であり、
`checks` が担保しない部分（Content IDクレーム等）を拾う。**両者は役割が違い、どちらか一方を
省略できない。**

`checks` が担保する3項目（設計 §5.6 の表）:

| チェック | 内容 | 実装 |
|---|---|---|
| 効能表現リンター | metadata（title・description・tags）にNG辞書を適用 | 既存 `policy.ts`（Task 1で `scriptPolicy.ts` から改名済み） の `lintText` を転用 |
| uniqueness重複 | `assets/*/uniqueness.json` を走査し、同一seed・同一パラメータ列の再利用を検出 | 新規。**P0は完全一致のみ** |
| ラウドネス検査 | `final.mp4` が -20〜-16 LUFS に入っているか | ffmpeg `ebur128` で測定して範囲判定 |

## スコープ

- **やる**:
  - metadata の `title` / `description` / `tags` への `lintText` 適用
  - `uniqueness.json` の**完全一致**による重複検出（`findDuplicates`）
  - ffmpeg `ebur128` によるラウドネス測定・-20〜-16 LUFS判定
  - `checks.json` への結果集約
  - 1つでもfailなら `YanchaError` で落として `upload` に進ませない
- **やらない**:
  - **類似度判定はフェーズ1**（設計 §5.6。P0は完全一致のみで、近似検索・embedding等は入れない）
  - `upload` ステージ本体（Task 8）
  - `review.md` の生成（Task 9）
  - NG辞書の拡充（`policy.ts` の中身は据え置き。フェーズ1）
  - ラウドネスのターゲット値の確定（設計 §8 リスク6。P0は範囲判定のみ）

## 現状（変更の起点）

`src/stages/policy.ts`（Task 1 で `scriptPolicy.ts` から改名され、関数も変わっている前提）:
- **旧**: `assertSafeScriptText(text: string): void` — 違反があれば即 `throw`。
- **新（Task 1後）**: `lintText(text: string): readonly string[]` — **例外を投げず違反一覧を返す**。
  理由: `checks` が結果を `checks.json` に集約する必要があるため（計画 Task 1 Step 5）。
  NG辞書（禁止パターン配列）の中身自体は変わらない。**このタスクを書く時点でまだ改名されて
  いない可能性があるため、実装時に `src/stages/policy.ts` の実際のシグネチャを確認すること。**

現時点（改名前）の実体は `src/stages/scriptPolicy.ts`:

```typescript
import { YanchaError } from "@yancha/core";

const prohibitedPatterns: readonly RegExp[] = [
  /治(る|します|せる)/u,
  /改善(する|します|できる)/u,
  /病気/u,
  /不眠(症)?が(治|改善)/u,
  /\d+\s*Hz.*(効く|効果|改善|治)/iu
];

export function assertSafeScriptText(text: string): void {
  const matched = prohibitedPatterns.find((pattern) => pattern.test(text));
  if (matched) {
    throw new YanchaError("POLICY_VIOLATION", `台本に断定的な健康効能表現の疑いがあります: ${matched.source}`);
  }
}
```

`src/types/pipeline.ts`（Task 1 で `StageId` が再構成される前提。現状は旧定義）:

```typescript
export type StageId =
  | "theme" | "script" | "narration" | "music" | "audioMix"
  | "visual" | "video" | "metadata" | "humanReview" | "publish";

export interface StageArtifact<TData = unknown> {
  readonly videoId: string;
  readonly stageId: StageId;
  readonly createdAt: string;
  readonly data: TData;
}

export interface StageRunner {
  readonly id: StageId;
  readonly outputFile: string;
  run(context: PipelineContext): Promise<StageArtifact>;
}
```

Task 1 で `StageId` に `"checks"` が加わり、`Task 2` で `SceneData` / `UniquenessData` が、
`Task 6` で `MetadataData` が追加される前提。**本タスク着手時点でこれらが揃っているか
（Task 1・2・5・6 がマージ済みか）を先に確認すること。** 揃っていなければ依存タスクを先に完了させる。

関連:
- `packages/core/src/errors.ts` — `YanchaError` / `ErrorCode` union。使うのは `POLICY_VIOLATION`
  （効能表現違反）と `ARTIFACT_INVALID`（uniqueness重複・ラウドネス範囲外）。両方とも既存の union
  に含まれているため**新規コード追加は不要**。
- `src/paths.ts` — `resolveVideoPaths`。Task 1 で `uniquenessJson` / `finalMp4` / `metadataJson` /
  `checksJson` が追加されている前提。
- `src/stages/index.ts` — `createStageRunners`。ここに `ChecksStage` を差し込む。

## Global Constraints（計画から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示。
- **コメント・ログ・エラーメッセージは日本語。**
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。
- テストは vitest（globals 有効）。
- **`Math.random()` / `new Date()` の直接使用を禁止**（seed駆動・決定論。設計 §4.1）。
  `createdAt` 等が必要な場合は呼び出し側（テストでは固定値）から注入する。
- **ffmpeg の実行そのものは単体テストしない**（設計 §6）。
  → **`ebur128` の stderr → 数値へのパースを純関数に切り出し、その純関数だけをテストする。**
  ffmpeg 実行の子プロセス起動部分は `@yancha/core` の `runFfmpeg`（Task 1 で追加）を使い、
  テストではモックまたは呼ばない。
- コミットは日本語 `prefix: 要約`。`#26` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

```typescript
// src/stages/uniquenessCheck.ts
// 過去の uniqueness と比較し、完全一致する動画IDを返す。
// P0は完全一致のみ（類似度判定はフェーズ1。設計 §5.6）。
export function findDuplicates(
  current: UniquenessData,
  past: readonly UniquenessData[]
): readonly string[];
```

```typescript
// src/stages/loudness.ts
// ffmpeg ebur128 の stderr 出力から積分ラウドネス(LUFS)を抽出する純関数。
// フォーマット例:
//   [Parsed_ebur128_0 ...] Summary:
//
//     Integrated loudness:
//       I:         -18.4 LUFS
//       Threshold: -28.9 LUFS
// のような行から `I:` の数値を取り出す。
export function parseIntegratedLoudness(stderr: string): number;

// 測定値が -20〜-16 LUFS の範囲内かどうかを判定する純関数。
export function isLoudnessInRange(lufs: number): boolean;
```

```typescript
// checks.json の構造
export interface ChecksData {
  readonly videoId: string;
  readonly policyLint: {
    readonly passed: boolean;
    readonly violations: readonly string[]; // lintText の返り値をtitle/description/tags分まとめたもの
  };
  readonly uniqueness: {
    readonly passed: boolean;
    readonly duplicateVideoIds: readonly string[]; // findDuplicates の結果
  };
  readonly loudness: {
    readonly passed: boolean;
    readonly measuredLufs: number;
    readonly targetRange: { readonly min: number; readonly max: number }; // -20 / -16 固定
  };
  readonly overallPassed: boolean; // 上記3つのAND
}
```

`overallPassed` が `false` なら `ChecksStage.run` は `YanchaError` を投げる
（`checks.json` 自体は fail の内容も含めて書き出してから投げる。理由: 人間が
`checks.json` を見て「何が落ちたか」を確認できるようにするため）。

---

## Step 1: 効能表現リンター（既存 `policy.ts` の適用先を台本→メタデータに変更）

- `metadata.json`（`StageArtifact<MetadataData>`）を読み込む。
- `MetadataData` の `title` / `description` / `tags`（配列）それぞれに `lintText` を適用する。
  - `tags` は配列なので**各要素に適用**し、違反を1つの配列にまとめる
    （どのタグが引っかかったか分かるよう、`タグ「${tag}」: ${violation}` のように文脈を残すこと）。
- 違反が1件でもあれば `policyLint.passed = false`。
- **`lintText` が存在しない場合**（Task 1 の改名がまだされておらず `assertSafeScriptText` のまま
  の場合）は、Codex側の判断で**先に `policy.ts` へ改名し `lintText` へシグネチャ変更する作業を
  先行させて良い**（本来 Task 1 の作業だが、依存関係上 `checks` が最初の利用者になるため）。
  ただしその場合、変更内容を必ず日本語コミットで分離し、コミットメッセージに `#26` に加え
  Task 1（骨格組み替え）の趣旨も明記すること。

## Step 2: uniqueness 重複チェック（純関数）

`src/stages/uniquenessCheck.ts`:

```typescript
export function findDuplicates(
  current: UniquenessData,
  past: readonly UniquenessData[]
): readonly string[] {
  // current と「完全一致」する past のうち videoId を集める。
  // 「完全一致」の定義: seed / audioPreset / audioLayers（順序込み） / visualPreset / visualParams
  // が全て一致すること。自分自身（同じ videoId）は比較対象から除外する。
}
```

- 呼び出し側（`ChecksStage`）が `assets/*/uniqueness.json` を走査して `past` を集める。
  - `config.assetsDir` 配下の各ディレクトリの `uniqueness.json` を読み、パースできたものだけ集める
    （存在しない・壊れているディレクトリはスキップしてよい。ログにwarnを出す）。
  - **走査はI/Oなので `findDuplicates` 自体には持ち込まない**。純関数として
    `(current, past)` を受けてテストできる形を必ず保つこと。
- `duplicateVideoIds` が1件でもあれば `uniqueness.passed = false`。

## Step 3: ラウドネス検査

`src/stages/loudness.ts`:

- `runFfmpeg`（`@yancha/core`）で `final.mp4` に対し `ebur128` フィルタを実行する:
  ```
  ffmpeg -i final.mp4 -af ebur128=framelog=verbose -f null -
  ```
- stderr を `parseIntegratedLoudness(stderr): number` に渡し、`Integrated loudness` の `I:` 値
  （単位 LUFS）を抽出する。
  - パースできない場合（想定フォーマットにマッチしない）は `YanchaError("CLIENT_ERROR", ...)`
    ではなく、ffmpeg絡みの失敗として妥当な既存コード（`ARTIFACT_INVALID` が適切。
    「final.mp4からラウドネス値を取得できなかった」という日本語メッセージにする）で落とす。
- `isLoudnessInRange(lufs: number): boolean` で -20〜-16 LUFS の範囲内かを判定する
  （境界値は両端含む: `lufs >= -20 && lufs <= -16`）。
- **測定値のパース（stderr → 数値）を純関数として切り出し、これだけを単体テストする。**
  ffmpeg の実行自体（`runFfmpeg` 呼び出し）はテストしない（Global Constraints）。

## Step 4: `ChecksStage`

`src/stages/checks.ts`:

```typescript
export class ChecksStage implements StageRunner {
  readonly id = "checks" as const;
  readonly outputFile = "checks.json";

  constructor(private readonly config: AppConfig) {}

  async run(context: PipelineContext): Promise<StageArtifact<ChecksData>> {
    // 1. metadata.json を読み lintText を適用
    // 2. uniqueness.json（自分の分）＋ assets/*/uniqueness.json（過去分）を集めて findDuplicates
    // 3. final.mp4 に ebur128 をかけてラウドネス判定
    // 4. ChecksData を組み立てて checks.json に書き出す
    // 5. overallPassed が false なら YanchaError で落とす（upload に進ませない）
  }
}
```

- `checks.json` への書き出しは**必ず `YanchaError` を投げる前に行う**
  （fail の内容を人間・後続デバッグが確認できるようにするため。`try/finally` 等で担保する）。
- `overallPassed = policyLint.passed && uniqueness.passed && loudness.passed`。
- fail 時のエラーコードは `ARTIFACT_INVALID`（成果物が公開基準を満たさない、という意味で統一）。
  効能表現違反のみが原因の場合でも `POLICY_VIOLATION` に分けたい場合は、**どのチェックが原因かを
  メッセージ本文に列挙**した上で、いずれか1コードに統一して構わない（複数コードを跨ぐ複合失敗を
  表現する仕組みは `ErrorCode` union にないため、無理に増やさない）。
- `src/stages/index.ts` の `createStageRunners` に `ChecksStage` を差し込む
  （`metadata` の後・`upload` の前。Task 1 のステージ配列組み替え後の順序に従う）。
  Task 8（upload）がまだ未実装の間は、既存の `PlaceholderStage("publish", ...)` 等が
  後続に残っていて構わない。

---

## 完了の定義

- [ ] `findDuplicates(current, past)` の純関数テストが揃っている
  - 完全一致するpastが1件 → その videoId が返る
  - 完全一致するpastがない → 空配列
  - 自分自身と同じ videoId は比較対象から除外されている
  - seed / layers / params のいずれか1つでも違えば重複と判定しない
- [ ] `parseIntegratedLoudness` / `isLoudnessInRange` の純関数テストが揃っている
  - 典型的な ebur128 stderr 出力から正しく LUFS を抽出できる
  - 範囲内（-20〜-16、境界値含む）／範囲外それぞれで正しく判定される
  - 想定外フォーマットの入力でエラーになることを確認する
- [ ] `lintText` を title/description/tags に適用した結果が `policyLint.violations` に
      文脈込みで（どのフィールド・どのタグか分かる形で）反映される
- [ ] `checks.json` が `ChecksData` 構造で出力され、fail時も書き出されてから
      `YanchaError` が投げられることをテストで確認している
- [ ] `overallPassed = false` のとき `upload` ステージに進めない（`YanchaError` で
      パイプラインが停止する）ことを確認している
- [ ] `pnpm build`（`tsc --noEmit`）が通る
- [ ] `pnpm test` が通る
- [ ] **ffmpeg・音声の実行は単体テストしていない**（`runFfmpeg` はモック済み、またはテストで呼ばれていない）
- [ ] `Math.random()` / `new Date()` を新規に使っていない
- [ ] コミットメッセージが日本語で `#26` を紐付けている
