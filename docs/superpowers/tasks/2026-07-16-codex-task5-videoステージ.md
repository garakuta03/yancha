# Codex 指示書 — Task 5: `video` ステージ（ffmpeg合成）（Issue #24 / P0-5）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 5 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §4.3・§5.7

## なぜこれをやるか / 位置づけ

パイプラインは `theme → scene → audio → visual → video → metadata → checks → upload → review` の順で進む。
`audio`（Task 3 / #22）が `ambient.wav` を、`visual`（Task 4 / #23）が `visual-loop.mp4` を出し終えた前提で、
`video` ステージがこの2つを ffmpeg で合成し `final.mp4` を作る。

**`video` ステージは単なる「音と映像をくっつける」係ではない。** 設計 §4.3 が定めた
「尺とレンダリングコストを分離する」構造の**後半を担う**。前半（`visual-synth` が10秒ループ素材だけを
描く）はもう Task 4 で終わっている。ここで `-stream_loop` を使わずに済ませてしまうと、
Task 4 の「毎フレーム描画は1時間動画で11時間かかる」を回避した意味がなくなる。
**この1本のffmpegコマンドの組み方が、長尺動画を現実的な時間で作れるかどうかを決める。**

`video` の後段の `checks` ステージ（Task 7 / #25 予定）はラウドネスを `-20〜-16 LUFS` で判定し、
1つでも fail なら upload に進ませない（設計 §5.6）。したがって `video` 側のラウドネス正規化が
不十分だと、後段の自動チェックで毎回落ちることになる。**loudnorm 2パスにする理由はここにある。**

## スコープ

**やる**:
- `visual-loop.mp4`（ループ素材）× `ambient.wav`（尺全体）→ `final.mp4` の合成
- `-stream_loop` によるループ素材の尺までの伸長
- loudnorm 2パス（測定 → 適用）によるラウドネス正規化（ターゲット -16 LUFS）
- `VideoStage`（`scene.json` 読込 → ffmpeg合成 → `license.json` 追記）
- ffmpeg引数列の組み立てを純関数化し、単体テストする

**やらない**:
- ラウドネスの合否判定（`checks` ステージ / Task 7 の仕事。`video` は正規化するだけで判定しない）
- 音声のミキシング・複数レイヤー合成（Task 3 の `audio-synth` 側で完結済み。`video` が受け取るのは
  完成済みの単一 `ambient.wav`）
- 長尺化・複数プリセット対応（P0は60秒・雨1・シーン1のみ。設計 §1 非ゴール表）
- ffmpeg実プロセスの単体テスト（Global Constraints参照。引数列のみテストする）

## 現状（変更の起点）

- `src/stages/index.ts`: `createStageRunners` はステージ配列をハードコードしている。現状の `video` は
  `PlaceholderStage("video", "video.meta.json", ..., ["visual.mp4", "mix.wav"], ["final.mp4"])` で止まっている。
  **このプレースホルダを `VideoStage` に差し替える。**
- `src/types/pipeline.ts`: 現行の `StageId` union は旧・朗読前提（`script`/`narration`/`music`/`audioMix`/`humanReview`/`publish`）
  のままで、Task 1（#21予定）でまだ組み替えられていない。本タスク時点で `StageId` に `"video"` が
  含まれていること、`ThemeData`/`SceneData` 等の型が Task 1・Task 2 の完了を前提に存在していることを
  **依存タスクの成果物として仮定してよい**。存在しない場合は本タスクの前提（Task 1〜4完了）が
  満たされていないので、先にそちらを確認すること。
- `packages/core/src/index.ts`: 現状は `YanchaError` / `StageError` / `toErrorMessage` / `Logger` /
  `readJson` / `writeJson` のみを re-export している。**`runFfmpeg` はまだ無い**（Task 1 / #21 で
  `packages/core/src/ffmpeg.ts` に追加される前提）。シグネチャは計画に定義済み:
  ```typescript
  export function runFfmpeg(args: readonly string[], options?): Promise<{ stdout: string; stderr: string }>;
  ```
  非0終了時は stderr を載せて `YanchaError("FFMPEG_ERROR", ...)` を投げる想定（本タスクでは
  `runFfmpeg` 自体は変更しない。無ければ Task 1 未完了として作業を止め、依存関係を確認すること）。
- `src/stages/script.ts`（`ScriptStage`）が「読込 → 処理 → 書出 → `license.json` 追記」という
  **ステージの型**を示す転用元。`VideoStage` もこの形（`scene.json` 読込 → ffmpeg合成 → 書出 →
  license追記）を踏襲する。ただし `license.ts` の `writeLicenseJson`（全上書き）は Task 1 で
  `appendLicenseEntry`（追記）に置き換えられる予定。本タスクでは **`appendLicenseEntry` が存在する
  前提で使う**（`writeLicenseJson` を新規に使わないこと）。
- `packages/core/src/errors.ts`: `ErrorCode` union は現状
  `"CONFIG_MISSING" | "CONFIG_INVALID" | "STAGE_FAILED" | "STAGE_NOT_IMPLEMENTED" | "ARTIFACT_INVALID" | "POLICY_VIOLATION" | "CLIENT_ERROR"`。
  **`"FFMPEG_ERROR"` が無い場合は Task 1 側の追加漏れ**。本タスクでは `runFfmpeg` が投げる
  `YanchaError` をそのまま伝播させればよく、`ErrorCode` union 自体はこのタスクで変更しない。

## Global Constraints（計画から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示。
- コメント・ログ・エラーメッセージは日本語。
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。
- テストは vitest（globals 有効）。
- **`Math.random()` / `new Date()` の直接使用を禁止**（seed駆動・決定論。設計 §4.1）。
  `createdAt` 等の時刻フィールドが必要な場合は既存ステージ（`ScriptStage`）同様、呼び出し時点の
  `new Date().toISOString()` を許容している既存パターンに合わせてよいが、**新規のランダム性は入れない**。
- **ffmpeg・音声・映像の実行は単体テストしない。** パラメータ→ffmpeg引数列の組み立てを
  純関数にしてテストする（設計 §6）。`buildLoudnormMeasureArgs` / `buildMuxArgs` がその純関数。
- 外部I/O（`runFfmpeg`）は `VideoStage` から呼ぶ形にし、引数組み立てとは分離する
  （テストは引数組み立て関数のみを対象にし、`runFfmpeg` はモック不要＝呼ばない）。
- コミットは日本語 `prefix: 要約`。**`#24` を紐付ける**。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

`src/stages/ffmpegArgs.ts`（新規）:

```typescript
// ffmpeg loudnorm の測定値（1パス目の標準エラー出力から抽出したJSON部分）
export interface LoudnormMeasurement {
  readonly input_i: string;
  readonly input_tp: string;
  readonly input_lra: string;
  readonly input_thresh: string;
  readonly target_offset: string;
}

// 1パス目: ラウドネス測定用の引数を組み立てる（音声のみ・出力は破棄前提）
export function buildLoudnormMeasureArgs(input: string): readonly string[];

// 2パス目: 測定値を適用し、ループ素材を尺まで伸ばして映像と合成する引数を組み立てる
export function buildMuxArgs(opts: {
  readonly visualLoop: string;
  readonly audio: string;
  readonly output: string;
  readonly durationSeconds: number;
  readonly measured: LoudnormMeasurement;
}): readonly string[];
```

`src/stages/video.ts`（新規）:

```typescript
export class VideoStage implements StageRunner {
  readonly id: StageId; // "video"
  readonly outputFile: string; // "video.meta.json" 等、既存命名規則に合わせる
  run(context: PipelineContext): Promise<StageArtifact>;
}
```

## Step 1: `-stream_loop` でループ素材を尺まで伸ばす

**入力は `visual-loop.mp4`（10秒のループ素材）であって尺全体ではない**（設計 §4.3）。
`visual` ステージ（Task 4）は `loopSeconds`（既定10秒）分しか描画していない。ここで
「素直に映像を尺分だけ切り出す／繰り返し結合する」実装にすると、Task 4 が避けた
「毎フレーム描画」の意味が失われる。**必ず `-stream_loop -1` で無限ループ入力にし、
`-t <durationSeconds>` で尺に切る。**

```
ffmpeg -stream_loop -1 -i visual-loop.mp4 -i ambient.wav -t <durationSeconds> ...
```

- `-stream_loop -1` は1本目の入力（映像）にのみ付ける。`ambient.wav` は `audio` ステージ
  （Task 3）が既に尺全体をレンダリング済みなのでループ不要。
- `-t durationSeconds` は出力の尺を確定させる（映像・音声どちらかが尺よりわずかに長くても切り捨てる）。
- **禁止**: ループを事前に展開して尺全体のmp4を作ってから合成する実装。これは
  「レンダリングコストを尺から独立させる」という Task 4 の設計判断を無効化する
  （設計 §4.3: 10秒ループ＝約2分、尺が1時間でも変わらない、という前提が崩れる）。

## Step 2: loudnorm 2パスの引数組み立てを純関数で

設計 §5.7 の理由: **1パスの loudnorm はターゲットLUFSへの収束を保証しない。**
直後の `checks` ステージ（Task 7）が `-20〜-16 LUFS` の範囲判定をするため、1パスで
収束が甘いと自動チェックが不安定に fail し、`upload` に進めなくなる。だから2パスにする。

**1パス目（測定）**:

```typescript
// 1パス目: 測定用の引数を組み立てる。出力は捨てる（null muxer）。
// stderr の JSON ブロックから LoudnormMeasurement を後段でパースする。
export function buildLoudnormMeasureArgs(input: string): readonly string[] {
  return [
    "-i", input,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
    "-f", "null",
    "-"
  ];
}
```

- ターゲットは **-16 LUFS**（設計 §8 リスク6: `-20〜-16` の範囲のうち**上端**を採用。
  範囲そのものの最終確定はフェーズ1に持ち越すが、P0は具体値を1つ決めないと loudnorm に
  渡せないため、`checks` の判定範囲の上端に寄せる）。
- `-af loudnorm=...:print_format=json` の出力（`Input Integrated` 等のJSONブロック）を
  `VideoStage` 側でパースして `LoudnormMeasurement` を得る。**このパース処理自体は
  ffmpeg実行を伴わないので、必要なら純関数として切り出しテスト対象にしてよい**
  （必須ではない。`buildLoudnormMeasureArgs` / `buildMuxArgs` の引数組み立てテストが必須）。

**2パス目（適用＋合成）**:

```typescript
// 2パス目: 測定値を適用し、ループ素材を尺まで伸ばして合成する引数を組み立てる
export function buildMuxArgs(opts: {
  readonly visualLoop: string;
  readonly audio: string;
  readonly output: string;
  readonly durationSeconds: number;
  readonly measured: LoudnormMeasurement;
}): readonly string[] {
  const { visualLoop, audio, output, durationSeconds, measured } = opts;
  return [
    "-stream_loop", "-1",
    "-i", visualLoop,
    "-i", audio,
    "-t", String(durationSeconds),
    "-af",
    `loudnorm=I=-16:TP=-1.5:LRA=11:` +
      `measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:` +
      `measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:` +
      `offset=${measured.target_offset}:linear=true:print_format=summary`,
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    output
  ];
}
```

- `-c:v copy`: 映像は `visual-synth` が既に出したエンコード済みmp4をそのまま使い、
  再エンコードしない（Task 4 の性能前提を壊さないため。音声フィルタだけ当てる）。
  ただし `-stream_loop` と `-c:v copy` の組み合わせでコンテナ側の問題が出た場合は
  最小限の再エンコードに切り替えてよいが、**その場合も理由をコード内コメントに残すこと**。
- `-shortest` は `-t` で尺を切っている以上必須ではないが、保険として残す。
- **引数列に `-stream_loop` と `-t` が両方含まれることを単体テストで担保する**（下記「完了の定義」）。

## Step 3: `VideoStage`

`src/stages/video.ts`。`ScriptStage`（`src/stages/script.ts`）の形を踏襲する:

1. `scene.json`（`StageArtifact<SceneData>`）を読み込み、`durationSeconds` を取り出す。
2. `context.videoDir` 配下の `visual-loop.mp4` と `ambient.wav` のパスを組み立てる
   （`resolveVideoPaths` に `visualLoop` / `ambientWav` / `finalMp4` が Task 1 で追加されている前提。
   無ければ `join(context.videoDir, "visual-loop.mp4")` 等で直接組み立ててよい）。
3. `buildLoudnormMeasureArgs` で1パス目の引数を組み立て、`runFfmpeg` を呼んで stderr を得る。
4. stderr の JSON ブロックをパースして `LoudnormMeasurement` を得る
   （`print_format=json` のブロックは stderr の中に単独のJSONオブジェクトとして出力される。
   最初の `{` から最後の `}` までを取ってパースすればよい。壊れている場合は
   `YanchaError("CLIENT_ERROR", ...)` ではなく、**ffmpeg由来なので `runFfmpeg` と同じ
   エラー系統**として扱う。既存の `ErrorCode` に ffmpeg用のコードが無ければ
   `"STAGE_FAILED"` を使い、`VideoStage` の文脈が分かるメッセージを日本語で付ける）。
5. `buildMuxArgs` で2パス目の引数を組み立て、`runFfmpeg` を呼んで `final.mp4` を生成する。
6. `video.meta.json`（または既存命名規則に合わせたファイル名）に成果物メタを書き出す。
7. `appendLicenseEntry(context.videoDir, { assetType: "video", ... })` で証跡を追記する
   （`writeLicenseJson` は使わない。Task 1 で置き換え済みの前提）。

ターゲットは **-16 LUFS**（範囲 -20〜-16 の上端。設計 §8 リスク6 のとおり最終確定はフェーズ1）。

## Step 4: ループの継ぎ目を目視確認

**これは自動テスト項目ではなく、実装後にCodex自身（またはレビュー担当）が手作業で行う確認。**

`-stream_loop` の繋ぎ目で映像が「飛ぶ」（不連続に見える）ことがないかを、実際に生成した
`final.mp4` を目視して確認する。

- 飛ぶ場合、原因は `video` 側ではなく **Task 4（`visual-synth`）の完全ループ実装**にある
  （設計 §5.5: パーティクルの位相が `loopSeconds` で割り切れる周期になっておらず、
  末尾フレーム ≠ 先頭フレームになっている）。
- `video` ステージのコードを直して直る問題ではないので、**もし継ぎ目が飛んでいたら
  Task 4 側の Step 5（完全ループのシーン設計）の不具合として切り分け、そちらに修正を戻す**
  （本タスクのスコープでは `visual-loop.mp4` の中身は変更しない）。
- 確認できたかどうかを完了報告に一言添える（自動テストでは代替できない項目のため）。

## 完了の定義

- [ ] `buildLoudnormMeasureArgs` / `buildMuxArgs` の**純関数テスト**（`tests/ffmpegArgs.test.ts`）が存在し、
      以下を最低限カバーする:
  - [ ] `buildMuxArgs` が返す引数列に `-stream_loop` と `-1` が**この順で**含まれる
  - [ ] `buildMuxArgs` が返す引数列に `-t` と `durationSeconds` の文字列表現が含まれる
  - [ ] `buildLoudnormMeasureArgs` が対象の `input` パスを含む
  - [ ] `buildMuxArgs` が `visualLoop` / `audio` / `output` の各パスを引数列に含む
  - [ ] `buildMuxArgs` の `loudnorm` フィルタ文字列に `measured_I` 等、`measured` の値が反映されている
- [ ] `pnpm build`（`tsc --noEmit`）が通る
- [ ] `pnpm test` が通る
- [ ] `runFfmpeg` 自体・実際のffmpeg実行は単体テストしていない（テストは引数組み立てのみを対象にしている）
- [ ] `src/stages/index.ts` の `video` プレースホルダが `VideoStage` に差し替わっている
- [ ] `license.json` に `video` エントリが**追記**されている（上書きされていない。`appendLicenseEntry` 使用）
- [ ] ループの継ぎ目を目視確認した（結果を完了報告に記載。飛んでいた場合はTask4側の問題として切り分けた旨も記載）
- [ ] コミットメッセージが日本語で `#24` を紐付けている
