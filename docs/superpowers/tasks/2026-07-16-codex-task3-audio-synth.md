# Codex 指示書 — Task 3: `packages/audio-synth` MVP（Issue #22 / P0-3）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 3 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §3.1・§5.3・§4.3・§7.1

## なぜこれをやるか / 位置づけ

`audio` ステージ（scene.json → 環境音 → `ambient.wav`）の実体がまだない。設計 §7.1 で
GPUなしLinux実機によりすでに技術選定を確定済みで、**「依存ゼロのTypeScript実装で雨音が105行で
実装でき、seed再現性もbit一致まで確認済み」**という実証結果がある。Elementary Audio
（`@elemaudio/core`）は動作確認はできたが、wasm数MB＋独自DSLの学習コストが
「雨音1プリセット」という要件に見合わないため不採用。**これ以上の技術検証は不要で、
実装するだけの段階。**

このタスクは **Task 1（#20, `@yancha/core` への `createRng` / `deriveSeed` / `runFfmpeg` 追加）に依存する**。
Task 1 が先に完了している前提で着手すること。未完了ならブロックされている旨を報告して止まること。

`packages/audio-synth` は「ステージを知らない」独立ライブラリ＋CLIとして作る。理由は2つ:
1. 単体実行・単体テスト可能にする方針（CLAUDE.md）。
2. フェーズ3で「配信用セグメント生成」から**同じエンジンを別文脈で呼ぶ**ため、ステージ結合度を持たせない。

## スコープ

- **やる**: 雨1プリセットのみ。DSPプリミティブ（ホワイトノイズ・ワンポールLP/HP）。
  WAVエンコーダ（手書きヘッダ）。チャンクレンダリング→ffmpeg concat。
  peak/RMSクリッピング検出。決定論（同一seed→同一WAVバイト列）の担保。`AudioStage`。
- **やらない**:
  - 雨以外のプリセット（波・焚き火等）— フェーズ1。
  - BGM（メロディのある音楽）・Stable Audio — フェーズ2。設計の非ゴール表（§1）どおり、
    P0の自動E2Eには人間の編曲工程を含めない。
  - Elementary Audio / `node-web-audio-api` 等、外部DSPライブラリの導入 — §7.1で不採用確定済み。
  - `checks` ステージのラウドネス検査（-20〜-16 LUFS 判定）— Task 7 の領分。
    audio-synth が担当するのはあくまで**合成直後のクリッピング検出**のみ。

## 現状（変更の起点）

`packages/audio-synth` は**まだ存在しない新規パッケージ**。以下は既存パッケージ雛形からの転用元と
前提となる依存インターフェース。

**雛形として転用する `packages/research`**（`/home/ope/Projects/MY-PROJECT/yancha/packages/research/`）:
- `package.json`: `type: "module"`、`scripts.build = "tsc --noEmit"`、`scripts.test = "vitest run"`。
  `dependencies` に `@yancha/core: "workspace:*"` を持つ形をそのまま踏襲する。
  audio-synth では以下は不要: `@hono/node-server` / `better-sqlite3` / `hono` / `yaml` /
  `@types/better-sqlite3`。**依存はビルドツール（`tsx` / `typescript` / `vitest` / `@types/node`）
  以外は `@yancha/core` のみ**にする。
- `tsconfig.json`: ルート `tsconfig.json` を `extends`、`compilerOptions.rootDir: "."`、
  `include: ["src/**/*.ts", "tests/**/*.ts"]`。
- `vitest.config.ts`: `globals: true`、`include: ["tests/**/*.test.ts"]`。

**`@yancha/core`**（`packages/core/src/index.ts`）は現時点では
`YanchaError` / `StageError` / `toErrorMessage` / `Logger` / `readJson` / `writeJson` のみを
re-export している。**Task 1（#20）でここに `createRng(seed)` / `deriveSeed(videoId, purpose)` /
`runFfmpeg(args, options)` が追加される前提**でこのタスクを進める（計画 Task 1 Step 2・Step 3）。
また Task 1 で `ErrorCode` union（`packages/core/src/errors.ts`）に `FFMPEG_ERROR` が追加され、
`runFfmpeg` の非0終了は `YanchaError("FFMPEG_ERROR", ...)` を投げる。audio-synth 自身が
ffmpeg 非0終了を直接ハンドリングする必要はなく、`runFfmpeg` に任せてよい。

ルート `tsconfig.json`（`/home/ope/Projects/MY-PROJECT/yancha/tsconfig.json`）は
`target: ES2022` / `module: NodeNext` / `strict: true` / `noUncheckedIndexedAccess: true` /
`exactOptionalPropertyTypes: true`。audio-synth のコードもこの厳格設定を満たすこと。

`pnpm-workspace.yaml` は `packages: ["." , "apps/*", "packages/*"]` なので、
`packages/audio-synth/package.json` を置くだけでワークスペースに自動的に含まれる
（追記不要）。

## Global Constraints（計画・設計から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示（`NodeNext` 解決のため）。
- **コメント・ログ・エラーメッセージは100%日本語。**
- エラーは `@yancha/core` の `YanchaError`（code付き）で送出。
- テストは vitest（`globals: true`。`import { describe }` 等は不要）。
- **`Math.random()` の使用を絶対禁止。** ノイズ生成は必ず `createRng(seed)` の戻り値関数を経由する。
  同一seedから同一の出力バイト列が再現できることが本タスクの成立条件そのもの。
- **`new Date()` / `Date.now()` の直接使用を禁止**（決定論。時刻が要る箇所は引数で注入する）。
- **⚠️ 最重要制約: 新規に外部npm依存パッケージを追加しないこと。**
  `package.json` の `dependencies` は `@yancha/core: "workspace:*"` のみ。
  DSP・WAVエンコード・ノイズ生成は全て自前実装（設計 §7.1 で確定済み）。
  Elementary・node-web-audio-api・その他音声ライブラリを一切追加しないこと。
- ffmpeg の実行は単体テストしない（設計 §6）。ffmpeg 引数列の組み立てとDSP純関数だけをテスト対象にする。
- audio-synth は**ステージを知らない純粋なライブラリ＋CLI**にする。`src/stages/*` の型・
  パスヘルパーに依存させないこと。
- コミットは日本語 `prefix: 要約`。`#22` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

`packages/audio-synth/src/index.ts` からの公開API:

```typescript
// scene.json の audio セクションから環境音WAVを合成し、outPath に書き出す。
// P0スコープは雨(preset: "rain")のみ。
export interface AudioLayer {
  readonly kind: string;        // 例: "base" | "gust" | "drops" など、レイヤーの識別子
  readonly gain: number;        // 0〜1
  readonly cutoffHz: number;    // フィルタのカットオフ周波数
}

export interface SynthesizeAmbientOptions {
  readonly preset: "rain";
  readonly layers: readonly AudioLayer[];
  readonly durationSeconds: number;
  readonly seed: string;
  readonly outPath: string;
  readonly ffmpegPath: string;   // runFfmpeg に渡すffmpeg実行パス
}

export async function synthesizeAmbient(opts: SynthesizeAmbientOptions): Promise<void>;
```

`dsp.ts` / `wav.ts` は**副作用なしの純関数**として書き、それぞれ単体テストする。

## Step 1: パッケージの雛形

- `packages/audio-synth/package.json` を `packages/research/package.json` の形を踏襲して作成:
  - `name: "@yancha/audio-synth"`
  - `dependencies: { "@yancha/core": "workspace:*" }` のみ
  - `devDependencies: { "@types/node", "tsx", "typescript", "vitest" }`（`packages/research` と同バージョン帯）
  - `scripts: { "build": "tsc --noEmit", "test": "vitest run", "audio-synth": "tsx src/cli.ts" }`
- `packages/audio-synth/tsconfig.json` は `packages/research/tsconfig.json` と同一パターン
  （`extends: "../../tsconfig.json"`、`rootDir: "."`、`include: ["src/**/*.ts", "tests/**/*.ts"]`）。
- `packages/audio-synth/vitest.config.ts` は `packages/research/vitest.config.ts` と同一パターン。
- ディレクトリ: `packages/audio-synth/src/{index.ts,rain.ts,dsp.ts,wav.ts,cli.ts}`、
  `packages/audio-synth/tests/{dsp.test.ts,wav.test.ts,rain.test.ts}`。
- `cli.ts` は最低限、コマンドライン引数から `SynthesizeAmbientOptions` を組み立てて
  `synthesizeAmbient` を呼ぶ薄いラッパーでよい（本タスクの主目的ではない）。

## Step 2: DSPプリミティブ（純関数・テスト対象）

`dsp.ts` に以下を実装する:

```typescript
// createRng(seed) が返す0〜1の一様乱数関数からホワイトノイズのサンプル列を生成する。
export function generateWhiteNoise(rng: () => number, sampleCount: number): Float32Array;

// ワンポールローパスフィルタ（IIR 1次）。cutoffHz と sampleRate から係数を導出して適用する。
export function applyOnePoleLowPass(samples: Float32Array, cutoffHz: number, sampleRateHz: number): Float32Array;

// ワンポールハイパスフィルタ（ローパスとの差分、または直接係数を導出して適用する）。
export function applyOnePoleHighPass(samples: Float32Array, cutoffHz: number, sampleRateHz: number): Float32Array;
```

- **`Math.random()` は使わない。** ノイズ生成は必ず引数で受けた `rng`（`@yancha/core` の
  `createRng(seed)` の戻り値）を経由すること。`dsp.ts` 自体は `createRng` を import しない
  （呼び出し側の `rain.ts` が生成した `rng` を渡す形にして、`dsp.ts` を純粋な信号処理関数に保つ）。
- サンプルレートは 44100Hz 固定（P0スコープ）。
- **テスト（`dsp.test.ts`）**:
  - 同一 `rng`（同一seedから作った）から生成したノイズ列は同一になること。
  - 異なる `rng` からは異なる列になること。
  - ローパス/ハイパス適用後、出力配列の長さが入力と一致すること。
  - 極端なカットオフ（0Hz付近・ナイキスト付近）でNaN/Infinityが出ないこと。

## Step 3: WAVエンコーダ（純関数・テスト対象）

`wav.ts` に以下を実装する:

```typescript
// Float32Array（-1.0〜1.0想定）のチャンネル別サンプル列をWAV(PCM S16LE / 44.1kHz / 2ch)バッファへ変換する。
// WAVヘッダ(RIFF/fmt /data)は外部ライブラリを使わず手書きする。
export function encodeWav(channels: readonly Float32Array[], sampleRateHz: number): Buffer;
```

- チャンネル数は `channels.length`（P0は2chステレオを想定するが、関数自体は任意チャンネル数を許容してよい）。
- Float32 → Int16 変換時は `[-1, 1]` にクランプしてから `* 32767` する（クリッピング検出は
  Step 5 で別途行うため、ここでは単純な変換でよい）。
- **テスト（`wav.test.ts`）**:
  - 先頭4バイトが `"RIFF"`、8〜11バイト目が `"WAVE"` であること。
  - `fmt ` チャンクの `sampleRate` / `numChannels` / `bitsPerSample`(=16) が指定値と一致すること。
  - `data` チャンクのサイズが `サンプル数 × チャンネル数 × 2バイト` と一致すること。
  - 出力バッファ全体の長さが `44 + dataサイズ`（標準ヘッダ44バイト前提）と一致すること。
  - 既知の小さな入力（例: `[0, 0.5, -1, 1]` の1chデータ）に対して、data部の実バイト列が
    期待するInt16LEバイト列と一致すること。

## Step 4: 雨プリセット

`rain.ts` に以下を実装する:

```typescript
// scene.json の audio.layers（雨の構成レイヤー）からフィルタ付きノイズを合成する。
export function synthesizeRain(opts: {
  readonly layers: readonly AudioLayer[];
  readonly sampleCount: number;
  readonly sampleRateHz: number;
  readonly rng: () => number;
}): Float32Array;
```

- 各レイヤー（`layers`）ごとに `generateWhiteNoise` → カットオフに応じて
  `applyOnePoleLowPass` / `applyOnePoleHighPass` を適用 → `gain` を乗算 → 全レイヤーを加算合成する。
- レイヤーが複数ある場合、`rng` の消費順序を固定する（レイヤー配列の順に生成する）。
  これが崩れると同一seedでも順序次第で違う波形になり、決定論の担保（Step 7）が壊れる。

## Step 5: ⚠️ peak/RMSの自動検査を入れる（最重要ステップ）

設計 §7.1 の実証で **`peak=1.0000` ＝ クリッピングしていた**ことが判明している。
DSPを手書きする以上、ゲインステージングは自前で詰める必要がある。

- 合成後のサンプル列（チャンク単位、または最終WAV化直前）に対して peak（`max(abs(sample))`）を計算する。
- **peak が 1.0 に到達（またはそれ以上）したら `YanchaError("CLIENT_ERROR", ...)` ではなく、
  DSP起因のエラーとして投げる。** `ErrorCode` union に音声合成専用のコードがない場合は
  `"ARTIFACT_INVALID"` を使う（「生成された信号が仕様（クリップなし）を満たさない」という
  意味で artifact 系の失敗として扱う）。メッセージには実測peak値とレイヤー構成を含め、
  日本語で「クリッピングを検出したため合成を中断した」旨を明記する。
- これは **`checks` ステージのラウドネス検査（-20〜-16 LUFS、Task 7の領分）とは別物**。
  こちらは「合成直後の信号そのものが壊れていないか」を見る、audio-synth 自身の自己防衛。
- RMSも参考値として計算しログに残してよいが、**落とす基準はpeakのみ**でよい
  （RMSの妥当範囲判定はラウドネス検査の領分と重複するため）。

## Step 6: チャンクレンダリング → ffmpeg concat

設計 §4.3・§5.3: 長尺化してもメモリに全サンプルを載せない構造を最初から作る。

- `durationSeconds` をN秒（例: 10秒）単位のチャンクに分割し、チャンクごとに
  `synthesizeRain` → `encodeWav` → 一時ディレクトリにWAVファイルとして書き出す。
- 各チャンクの `rng` は**同一の `rng` インスタンスを使い続け、チャンクをまたいで連続的に消費する**
  こと（チャンクごとに `createRng` をやり直すと、チャンク境界で波形が不連続/繰り返しになる）。
- チャンクWAV群を ffmpeg の `concat` demuxer（`-f concat -safe 0 -i filelist.txt`）で結合し、
  最終的な `outPath` へ書き出す。`runFfmpeg`（`@yancha/core`）を使うこと。
- 一時ファイルは処理後に削除する（後続ステージの成果物ディレクトリを汚さない）。
- **音響は尺全体をレンダリングする**（映像と違いCPUが安いため。設計 §4.3。ループ短縮はしない）。

## Step 7: 決定論の検証

- 同一 `seed` ・同一 `layers` ・同一 `durationSeconds` で2回 `synthesizeAmbient` を実行し、
  **出力WAVファイルがバイト一致**することをテストで確認する（`rain.test.ts` または専用テスト）。
- 異なる `seed` では出力が異なること（バイト一致しないこと）も確認する。
- このテストは ffmpeg 呼び出し（concat）を経由してよいが、実行環境に ffmpeg がない場合に
  CIが落ちないよう、**チャンク結合前のサンプル列レベル**（`synthesizeRain` の戻り値）でも
  同一性を確認するテストを別途 `dsp.test.ts` か `rain.test.ts` に用意し、
  「ffmpeg実行を伴わない決定論テスト」と「ffmpeg実行を伴うE2E決定論テスト」を分離する。
  ffmpeg 実行を伴うテストは環境依存のため `describe.skipIf`（ffmpegパス未設定時にスキップ）等の
  配慮を検討してよい。

## Step 8: `AudioStage`

- `src/stages/audio.ts`（ルート側、新規）を追加する。
  - `scene.json` を読んで（`readJson`）`SceneData.audio`（`preset` / `layers`）と
    `SceneData.seed` / `SceneData.durationSeconds` を取得。
  - `deriveSeed(videoId, "audio")` ではなく、**scene.json に記録済みの `seed` をそのまま使う**
    （seedの決定は Task 2 の scene ステージの責務。audio ステージは記録された値を消費するだけ）。
    ※ scene.json 自体は Task 2 でまだ実装されていない可能性がある。存在しない場合はこのタスクの
    実装範囲外とし、`AudioStage` は `synthesizeAmbient` を正しく呼ぶことに専念すること。
  - `synthesizeAmbient` を呼び、`resolveVideoPaths` の `ambientWav`（Task 1 Step 8 で追加される
    パス。現時点で `src/paths.ts` にはまだ存在しない）へ書き出す。
  - 成功後、`appendLicenseEntry`（`@yancha/core` または `src/license.ts`。Task 1 で追記モデルへ
    変更される想定）で `assetType: "ambient"` のエントリを `license.json` に追記する。
  - 生成ログ（seed・レイヤー構成・durationSeconds 等）を `logs/` 配下に書く。
  - `src/stages/index.ts` の `createStageRunners` に `audio` ステージとして登録する
    （`PlaceholderStage` を置き換える）。
  - **この Step 8 は Task 1 の成果物（`resolveVideoPaths` の拡張・`appendLicenseEntry`・
    `StageId` 再構成）に強く依存する。** それらが未着手の場合は `packages/audio-synth` の
    ライブラリ本体（Step 1〜7）を完成させ、`AudioStage` の配線は Task 1 完了後に着手する
    判断でよい。その場合は本タスクの完了報告にその旨を明記すること。

## 完了の定義

- [ ] `dsp.test.ts` が Step 2 のケース（同一rng→同一列・異なるrng→異なる列・NaN/Infinityなし）を網羅している
- [ ] `wav.test.ts` が Step 3 のケース（ヘッダバイト列・チャンクサイズ・既知入力のバイト一致）を網羅している
- [ ] `rain.test.ts` に決定論テスト（同一seed→バイト一致WAV、異なるseed→不一致）がある
- [ ] peakが1.0に到達した場合に `YanchaError` が飛ぶことを確認するテストがある
- [ ] `pnpm --filter @yancha/audio-synth build`（`tsc --noEmit`）が通る
- [ ] `pnpm --filter @yancha/audio-synth test` が通る
- [ ] `package.json` の `dependencies` が `@yancha/core` のみである（新規外部依存を追加していない）
- [ ] `Math.random()` / `new Date()` / `Date.now()` を新規に使っていない
- [ ] ffmpeg の実行そのものは単体テストしていない（引数組み立て・DSP・WAV・決定論のみテスト対象）
- [ ] コミットメッセージが日本語で `#22` を紐付けている
