# Codex 指示書 — Task 4: `packages/visual-synth` MVP（Issue #23）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 4 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §5.5・§4.3・§7.2

## なぜこれをやるか / 位置づけ

P0のパイプラインは `theme → scene → audio → visual → video → metadata → checks → upload → review`
の順に組み替わる（設計 §3）。このうち `visual` ステージが呼ぶレンダリングエンジンが
`packages/visual-synth` である。**`video` ステージ（Task 5・#24）は本パッケージが出す
`visual-loop.mp4` を入力として `-stream_loop` で尺まで伸ばす**ため、本パッケージなしでは
E2Eが最後まで通らない。

対応Issue: **#23（P0-4）**。依存: **Task 1（#20）**（`StageId` 組み替え・`resolveVideoPaths` への
成果物パス追加・`deriveSeed` / `runFfmpeg` の `@yancha/core` への追加が前提）。
**Task 1が未完了の場合、`@yancha/core` の `deriveSeed` / `runFfmpeg` はまだ存在しない可能性がある。
その場合は `packages/core/src/index.ts` の実際のexportを確認し、無ければ本タスクでは
`visual-synth` 内に一時的な最小実装を置かず、Task 1 側の完了を待つか、
呼び出しインターフェースだけ先に決めて `VisualStage`（Step 10）の結線は保留してよい。**

技術選定は**実機検証済みで確定**（設計 §7）。以下は全て検証結果に基づく確定事項であり、
再検討・代替案の採用は不要。

## スコープ

- **やる**:
  - 新規パッケージ `@yancha/visual-synth`（Puppeteer + headless Chrome + three.js + SwiftShader）
  - **1シーンのみ**（パーティクル＋グラデーション）、**完全ループ**、**非フォトリアル様式**
  - `renderLoop(opts)` という1関数のライブラリAPI ＋ 簡易CLI
  - 白画面（レンダリング破損）の自動検出assert（**本タスクで最も重要**）
  - `src/stages/visual.ts`（`VisualStage`。scene.json → `renderLoop` 呼び出し → license追記）
- **やらない**:
  - ComfyUI・静止画生成モデル・GPUノードは使わない（第1層＝プロシージャルのみ。設計 §1 非ゴール表）
  - `headless-gl`（npm `gl`）は不採用（GPUなしヘッドレス機で X display 要求・xvfb必須。設計 §7.2）
  - シーン2種目以降・プリセット拡充（フェーズ1）
  - **尺全体のレンダリング**（後述。出すのは `loopSeconds` 分のループ素材のみ）
  - `video` ステージ側の `-stream_loop` 展開・loudnorm合成（Task 5・#24のスコープ）

## 現状（変更の起点）

- `packages/visual-synth` は**まだ存在しない**（新規パッケージ）。
- モデルにする既存パッケージ: `packages/research`（`@yancha/research`）。
  - `packages/research/package.json`: `"type": "module"`、`dependencies` に `@yancha/core: "workspace:*"`、
    `scripts.build = "tsc --noEmit"` / `scripts.test = "vitest run"`。
  - `packages/research/tsconfig.json`: ルートの `tsconfig.json` を `extends` し、
    `compilerOptions.rootDir = "."`、`include: ["src/**/*.ts", "tests/**/*.ts"]`。
  - ルート `tsconfig.json`: `module`/`moduleResolution` は `NodeNext`（**import に拡張子 `.js` が必須**）、
    `strict: true`、`types: ["node", "vitest/globals"]`。
  - `packages/core/package.json`: `"main": "src/index.ts"`、`"exports": { ".": "./src/index.ts" }`
    （ビルド成果物を挟まずソースを直接参照する構成。`visual-synth` も同じ形にする）。
- `packages/core/src/index.ts` の現状export: `YanchaError` / `StageError` / `toErrorMessage` /
  `ErrorCode` / `Logger` / `LogLevel` / `readJson` / `writeJson`。
  **`createRng` / `deriveSeed` / `runFfmpeg` はまだ存在しない**（Task 1 で追加される予定。設計 §5.0）。
  → 本タスクの Step 9（決定論検証）・`VisualStage`（Step 10）は、これらが実装済みであることを
  前提にしてよいが、実装時点で無ければ Task 1 の進捗を確認すること。
- ルート `vitest.config.ts`: `test.globals = true`、`test.include = ["tests/**/*.test.ts"]`
  （`visual-synth` にも同形の `vitest.config.ts` を置く）。
- `src/stages/script.ts` が既存ステージの形の手本（`theme.json` 相当の入力読込 →
  生成処理呼び出し → 成果物書出 → `license.json` への記録、という骨格）。
  ただし `license.ts` の追記API（`appendLicenseEntry`）は Task 1 で導入される予定のため、
  本タスクの Step 10 では**そのAPIが存在する前提**で呼び出すこと（存在しなければ Task 1 待ち）。
- 出力パス: `visual-loop.mp4` は Task 1 の `resolveVideoPaths` に追加される `visualMp4` を使う
  （キー名はTask1の実装に従う。無ければ `path.join(context.videoDir, "visual-loop.mp4")` で仮置きしてよい）。

## Global Constraints（計画から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示（`NodeNext` のため）。
- **コメント・ログ・エラーメッセージは日本語。**
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。
- テストは vitest（globals 有効）。
- **`Math.random()` / `new Date()` の直接使用を禁止**（seed駆動・決定論。設計 §4.1）。
  乱数・位相は seed（`deriveSeed(videoId, "visual")`）から導出する。
- **ffmpeg・ブラウザレンダリングの実行そのものは単体テストしない**（実行時間・環境依存。設計 §6）。
  代わりに:
  - パラメータ→ffmpeg引数列の組み立てを純関数にしてテストする（`args.test.ts`）
  - 起動可能性・基本的な結線を軽く確認する sanity テスト（`sanity.test.ts`）を用意する
    （実ブラウザを起動する場合はCI環境で失敗しうる点に注意。**重い場合はスキップ可能にする**）
- コミットは日本語 `prefix: 要約`。`#23` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

```typescript
// packages/visual-synth/src/index.ts

export type VisualPreset = "particles";

export interface VisualParams {
  // scene.json の visual.params に対応する数値レンジ。
  // Task 2（sceneSchema）側で最終確定するため、ここでは最小限のフィールドのみ定義し、
  // 未知キーを許容する（Record拡張）ことで循環依存・過剰な結合を避ける。
  readonly particleCount?: number;
  readonly [key: string]: number | string | undefined;
}

export interface RenderLoopOptions {
  readonly preset: VisualPreset;
  readonly params: VisualParams;
  readonly loopSeconds: number;   // 既定10秒。完全ループの周期
  readonly seed: string;          // deriveSeed(videoId, "visual") で呼び出し側が導出
  readonly outPath: string;       // 出力先: visual-loop.mp4
  readonly fps?: number;          // 既定30
  readonly width?: number;        // 既定1920
  readonly height?: number;       // 既定1080
}

// 1シーン・完全ループの映像素材（visual-loop.mp4）をレンダリングする。
// 出力は loopSeconds 分のみ。尺全体への伸長は video ステージ（-stream_loop）が行う。
export async function renderLoop(opts: RenderLoopOptions): Promise<void>;
```

---

## Step 1: パッケージの雛形

`packages/visual-synth/`:
- `package.json`
  - `"name": "@yancha/visual-synth"`, `"private": true`, `"type": "module"`
  - `"main": "src/index.ts"`, `"exports": { ".": "./src/index.ts" }`（core に倣う）
  - `dependencies`: `puppeteer`, `three`, `@yancha/core: "workspace:*"`
  - `devDependencies`: `@types/node`, `typescript`, `tsx`, `vitest`（ルートのバージョンに合わせる）
  - `scripts`: `"build": "tsc --noEmit"`, `"test": "vitest run"`
- `tsconfig.json`（`research` に倣い、ルートを `extends`。`rootDir: "."`、
  `include: ["src/**/*.ts", "tests/**/*.ts"]`）
- `vitest.config.ts`（ルートに倣い `globals: true` / `include: ["tests/**/*.test.ts"]`）
- ルート `pnpm-workspace.yaml`（存在すれば）に `packages/visual-synth` が含まれることを確認する
  （既に `packages/*` のようなワイルドカードなら不要）。

## Step 2: ⚠️ SwiftShader フラグを必ず明示する

Puppeteer 起動オプションに以下を**定数化して**渡す（`browser.ts`）:

```typescript
// SwiftShader（CPUソフトウェアレンダリング）を強制するフラグ群。
// GPUなし環境（本番サーバー・CI）でWebGLを動かすために必須。
//
// ⚠️ このフラグを1つでも落とすと、例外もエラーログも出ないまま
// WebGLRenderer の生成は成功し、getParameter(VERSION) は "WebGL 2.0" を返し続け、
// にもかかわらず全フレームが真っ白（実測: 1,822B・輝度YAVG=234.97固定）になる。
// Chrome 150 で自動SwiftShaderフォールバックが削除されたため、明示指定が必須。
// 値は "swiftshader-webgl" であり "swiftshader" ではない（別名で失敗する）。
export const SWIFTSHADER_ARGS = [
  "--no-sandbox",              // Docker/CI前提
  "--disable-dev-shm-usage",   // Docker前提（/dev/shm不足対策）
  "--use-gl=angle",
  "--use-angle=swiftshader-webgl",
  "--enable-unsafe-swiftshader" // GPUプロセス内JITのリスクを伴うが、自前HTMLのみ描画するため許容
] as const;
```

**このフラグ列以外を推測で足したり削ったりしないこと。** 検証済みの組み合わせそのものを使う。

## Step 3: importmapのためローカルHTTP配信（`file://` 不可）

`three` を ESM importmap 経由で読み込むため、`file://` では動かない（`node:http` 未対応）。
`server.ts` に `node:http` で最小の静的ファイルサーバーを実装し、
`scenes/particles/{index.html,scene.js}` と `node_modules/three` の該当ファイルを配信する
（importmap で `three` のパスを解決できるようにする）。

- ポートは `0`（OS割当）で起動し、実際に割り当てられたポートを Puppeteer 側に渡す。
- レンダリング終了後は必ずサーバーを `close()` する（`try/finally`）。

## Step 4: ⚠️ フレーム番号駆動にする（rAF禁止）

`requestAnimationFrame` は壁時計時間に依存し**非決定論になる**（設計 §4.1 違反。禁止事項）。

- `scenes/particles/scene.js` 側に `window.__renderFrame(frameIndex: number): void` を実装する。
  この関数が呼ばれた瞬間の状態でシーンを1フレーム分描画し、即座に返る（`await` 不要な同期描画、
  もしくは描画完了を示す何らかの同期手段を用意する）。
- Puppeteer 側（`browser.ts`）は `page.evaluate((i) => window.__renderFrame(i), frameIndex)` を
  **for文で1フレームずつ順番に呼ぶ**。`requestAnimationFrame` や `setTimeout` によるループ駆動は禁止。
- パーティクルの位相・時刻はすべて `frameIndex` と `fps` から算出する
  （例: `t = frameIndex / fps`）。`Date.now()` 等は一切使わない。

## Step 5: 完全ループのシーン（パーティクル＋グラデーション）

`scenes/particles/scene.js`:
- three.js で1シーン構築。パーティクル群 ＋ 背景グラデーション。**非フォトリアル様式**
  （上位設計 §2。写実的な映像は作らない）。
- パーティクルの位相を **`loopSeconds` で割り切れる周期**にする。
  例: 各パーティクルの角速度 `ω_i` を `2π * n_i / loopSeconds`（`n_i` は整数）にすることで、
  `t=0` と `t=loopSeconds` で位相が一致する（＝末尾フレーム＝先頭フレーム）。
- 初期配置・速度・色などのパラメータ導出は `seed` から決定論的に行う
  （`@yancha/core` の `createRng(seed)` を使う。ブラウザ側JSに同じPRNGロジックを持ち込む場合は、
  依存を増やさず同アルゴリズムを移植するか、Node側でパラメータ配列を事前計算して
  `page.evaluate` に渡す設計にする。**後者を推奨**——ブラウザ側の実装を純粋な描画に絞れる）。
- `params`（`VisualParams`）で粒子数などを受ける。
- `seed` は呼び出し元（`VisualStage`）が `deriveSeed(videoId, "visual")` で導出して渡す
  （本パッケージ内で新たに `videoId` を扱う必要はない。`renderLoop` は既に導出済みの `seed` 文字列を受ける）。

## Step 6: フレーム取得は `page.screenshot`

```typescript
await page.screenshot({
  path: `${framesDir}/frame-${String(i).padStart(4, "0")}.png`,
  optimizeForSpeed: true
});
```

**`readPixels` → base64 → ffmpeg にしないこと。** 実測でこちらの方が遅い
（371.6ms/frame vs 517.2ms/frame。CDP越しのbase64転送コストがPNGエンコードより高いため。設計 §7.2）。
フレームは一時ディレクトリ（`outPath` と同じディレクトリ配下等）に連番PNGとして書き出し、
Step 8 のffmpeg変換後に削除する。

## Step 7: ⚠️ 白画面検出の assert（このタスクで最も重要なステップ）

**設計 §5.5 で実証された「静かな失敗」を機械的に検出する。** SwiftShaderフラグが1つでも
欠けると、例外なくブラウザは正常に見えたまま**全フレームが真っ白**になる
（実測: フラグなし → 全フレーム同一の1,822B・輝度YAVG=234.97固定）。**CIでも人間の目でも
気付きにくいため、ここで機械的に落とさない限り誰も気付かない。**

連番PNGの書き出し完了直後、ffmpeg `signalstats` フィルタで検査する:

```typescript
// レンダリング直後に輝度・フレーム間分散を検査し、
// 「白画面が例外なく生成される」実測済みの静かな失敗を機械的に検出する。
// ⚠️ このassertが visual-synth の中で最も重要な処理である。
// checks ステージではなくここで落とす（原因の近くで落とすため。設計 §5.5）。
async function assertNotBlankFrames(framesDir: string, frameCount: number): Promise<void> {
  // ffmpeg -i "frame-%04d.png" -vf signalstats -f null - などでYAVGを取得し、stderrをパースする
  // 検査observation:
  //   1. 全フレームのYAVGが閾値外（実測の白画面値 234.97 に近い・極端に高い/低い）なら異常
  //   2. フレーム間でYAVGの分散がゼロ（＝1フレームも変化していない）なら異常
  //      （パーティクルが動いていれば分散はゼロにならないはず）
  // いずれかに該当したら YanchaError("VISUAL_RENDER_BLANK", ...) 相当のコードで例外を投げる。
  // メッセージには実測YAVG値・検査対象フレーム数を含め、デバッグしやすくする。
}
```

- 使う `ErrorCode` は `packages/core/src/errors.ts` の既存union を確認し、該当するものがなければ
  **追加してよい**（`YanchaError` のcode追加は本タスクのスコープ内。ただし `errors.ts` の変更は
  最小限にし、他のcodeを壊さないこと）。
- **輝度閾値・分散閾値は定数化し、コメントで実測値（234.97）との関係を明記する。**
- このassertはPNG出力後・ffmpeg変換前に必ず実行する（壊れたループ素材をそもそも作らせない）。

## Step 8: ffmpegで連番PNG → `visual-loop.mp4`

```
ffmpeg -y -framerate <fps> -i "<framesDir>/frame-%04d.png" -pix_fmt yuv420p "<outPath>"
```

- 引数列の組み立ては純関数にして `args.test.ts` でテストする
  （`-framerate` / `-i` / `-pix_fmt yuv420p` / 出力パスが含まれることを確認）。
- 実行自体は `@yancha/core` の `runFfmpeg`（Task 1 で追加）を使う。無ければ
  `node:child_process` の `execFile` を直接使い、Task 1 完了後に `runFfmpeg` へ差し替える旨を
  コード中にコメントで残す。
- **出力は尺全体ではなく `loopSeconds` 分のループ素材である**（設計 §4.3）。
  `durationSeconds`（scene.jsonの尺、既定60秒）を本パッケージが知る必要はない。
  伸長は `video` ステージ（Task 5）の `-stream_loop` が担当する。
  **本タスクで尺全体を毎フレーム描画するような実装は絶対に作らないこと**
  （1080p/30fpsで約2.7fps実測。60秒尺を毎フレーム描画すると約11分、1時間尺なら約11時間かかる。
  ループ+`-stream_loop`構造がこれを回避する）。

## Step 9: 決定論の検証

`renderLoop` を**ブラウザプロセスを一度終了させてから再起動し、同じ `seed` で2回実行**し、
出力された連番PNG（もしくは `visual-loop.mp4`）が**バイト一致**することを確認するテストを書く
（実測で10/10フレーム一致を確認済み。同条件なら再現するはず）。

- このテストは実ブラウザ起動を伴うため重い。CI環境での実行時間・GPUなし環境での可否を考慮し、
  重すぎる場合は `sanity.test.ts` 内で最小限（1〜2フレームのみ・低解像度）に絞ってよい。
  ただし**バイト一致の検証そのものは省略しないこと**（決定論は設計の根幹。設計 §4.1）。
- 異なる `seed` → 異なる出力になることも確認する。

## Step 10: `VisualStage`

`src/stages/visual.ts`:

```typescript
// scene.json を読み、visual-synth の renderLoop を呼んで visual-loop.mp4 を生成するステージ。
export class VisualStage implements StageRunner {
  readonly id = "visual" as const;
  // ...
  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<...>> {
    // 1. scene.json を読み込む
    // 2. deriveSeed(context.videoId, "visual") で seed を導出
    //    （scene.json 側に既に visual 用 seed が記録されていればそちらを優先する設計もあり得るが、
    //    Task 2 の scene.json スキーマ確定を待つ。未確定なら deriveSeed を直接呼んでよい）
    // 3. renderLoop({ preset, params, loopSeconds, seed, outPath: <visual-loop.mp4のパス> })
    // 4. appendLicenseEntry(context.videoDir, { assetType: "visual", ... }) でlicense追記
    // 5. 生成ログを残す（設計の生成ログ方針に従う。既存ステージの慣習に倣う）
  }
}
```

- `src/stages/index.ts` の `createStageRunners` に `VisualStage` を組み込む
  （Task 1 で `StageId` に `"visual"` が既に含まれ、`PlaceholderStage` で仮置きされている想定。
  それを本実装に差し替える）。
- `appendLicenseEntry` / `resolveVideoPaths` の実際のシグネチャが Task 1 の実装と異なる場合は、
  Task 1 側のソースを確認して合わせること（本文書は計画時点の想定であり、Task 1 の実装が正）。

> **性能の目安（実測）**: 1080p/30fps で約2.7fps。**10秒ループ＝約2分。**
> 尺を伸ばしてもレンダリング時間は変わらない（設計 §4.3）。

---

## 完了の定義

- [ ] `packages/visual-synth/tests/sanity.test.ts` — `renderLoop` の基本的な結線（最小パラメータで
      実行し、出力ファイルが生成されること・白画面assertが機能していること）を確認する
- [ ] `packages/visual-synth/tests/args.test.ts` — ffmpeg引数組み立ての純関数をテストする
      （`-framerate` / `-pix_fmt yuv420p` 等が含まれることを確認。実行はしない）
- [ ] `pnpm build`（`tsc --noEmit`。ルート・`visual-synth` 双方）が通る
- [ ] `pnpm test` が通る
- [ ] `Math.random()` / `new Date()` / `Date.now()` を新規に使っていない（rAFも同様に不使用）
- [ ] **白画面検出assert（Step 7）が実装され、フラグを意図的に外した場合に検出できることを
      何らかの形で確認している**（実ブラウザでの再現テストが重ければ、閾値ロジック自体の
      純関数テストで代替してもよいが、必ず検証すること。**このタスクで最も重要な項目**）
- [ ] 出力が `visual-loop.mp4`（尺全体ではなく `loopSeconds` 分）であることをコード上で確認できる
- [ ] 決定論の検証（Step 9）が実装され、同一seed→バイト一致・異なるseed→別出力を確認している
- [ ] `src/stages/index.ts` に `VisualStage` が組み込まれ、`PlaceholderStage` から差し替わっている
      （Task 1 未完了で `StageId`/`resolveVideoPaths` が対応していない場合はこの限りでない旨を
      コミットメッセージかコメントに残す）
- [ ] コミットメッセージが日本語で `#23` を紐付けている
