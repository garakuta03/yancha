# Codex 指示書 — Task 2: `scene` ステージ（Issue #21）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 2 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §5.2・§4.1・§4.2、上位設計 §6.1（uniqueness / storyline）

## なぜこれをやるか / 位置づけ

`theme.json` から先の全ステージ（`audio` / `visual` / `video` / `metadata` / `checks`）は
`scene.json` の中身を信じて動く。ここで**プリセット名や数値をLLMの自由記述のまま通すと**、
後段のプロシージャル合成（音・映像）がクラッシュするか、無音・白画面のような
「静かな失敗」を起こす（設計 §4.2）。**scene ステージの役割は、LLMに"選択"だけさせて、
信号やコードには一切触れさせないよう境界を引くこと**。

さらに `uniqueness.json` は上位設計 §6.1 の固有性の機械的保証（重複動画の自動検知）を
支える唯一の入力になる。ここで seed・パラメータを正しく記録しないと、Task 7 の `checks`
ステージが機能しない。

**依存**: Task 0（#19, `generateJson`/`extractJson` の追加）と Task 1（#20, `StageId` 再構成・
`deriveSeed`・`appendLicenseEntry` の追加）が完了している前提。両方とも本タスクの前提コードとして
**既にマージ済みとして扱う**（実装中に無ければ先に確認すること）。

## スコープ

- **やる**:
  - `src/stages/sceneSchema.ts`（新規）— `SceneData` / `AudioLayer` / `VisualParams` /
    `UniquenessData` の型と `validateScene` 純関数
  - `src/stages/scenePrompt.ts`（新規）— LLMへ渡すプロンプト
  - `src/stages/scene.ts`（新規）— `SceneStage`（`script.ts` の形を転用）
  - `src/types/pipeline.ts` の修正（`ScriptData` を `SceneData` 参照に差し替え。詳細はStep 3）
  - `src/stages/index.ts` の修正（`scene` ステージの配線）
  - `tests/sceneSchema.test.ts`（新規）、`tests/sceneStage.test.ts`（新規）
- **やらない**:
  - `audio` / `visual` / `video` ステージの実装（Task 3〜5）
  - `metadata` ステージ（Task 6）。ただし `storyline` を後で使うのは metadata 側の仕事なので、
    ここでは `scene.json` に書き出すところまで
  - LLMクライアント自体の改修（Task 0で完了済みの前提。触るのは呼び出し側のみ）
  - `theme` ステージ・`license.ts` の追記モデル自体の実装（Task 1で完了済みの前提。呼ぶだけ）

## 現状（変更の起点）

`src/stages/script.ts` が**そのまま転用元の"形"**になる。読んで、同じ骨格で書き直す:

```typescript
// script.ts の形（現状）
export class ScriptStage implements StageRunner {
  readonly id = "script" as const;
  readonly outputFile = "script.meta.json";

  constructor(private readonly llmClient: LlmClient) {}

  async run(context) {
    const themeArtifact = await readJson<StageArtifact<ThemeData>>(join(context.videoDir, "theme.json"));
    const prompt = buildScriptPrompt(themeArtifact.data);
    const response = await this.llmClient.generate({ temperature: 0.7, messages: [...] });
    assertSafeScriptText(response.text);
    // ... script.md を書き出し、script.meta.json を書き出し、writeLicenseJson で証跡を「上書き」する
  }
}
```

`scene` ステージで変わる点（**転用ではなく転用元からの差分**として理解すること）:

1. `llmClient.generate` ではなく **`llmClient.generateJson(request, validateScene)`** を使う
   （Task 0 の成果物）。プレーンテキストの朗読は書き出さない。
2. `assertSafeScriptText` のような効能表現リンターはここでは呼ばない
   （設計上、効能リンターは `checks` ステージで metadata に適用する。Task 7）。
3. `writeLicenseJson`（全上書き）ではなく **`appendLicenseEntry`**（Task 1 の成果物、追記モデル）を使う。
4. `script.md` に相当する「本文ファイル」はない。代わりに **`scene.json` と `uniqueness.json` の2つ**を書き出す。
5. `seed` は LLM に生成させず、**`deriveSeed(context.videoId, "scene")`** で導出してから
   `scene.json` に書き込む（LLMの応答には含めない値として扱う。詳細はStep 3）。

`src/types/pipeline.ts` の現状:
- `StageId` union には `"scene"` が既に含まれている前提（Task 1 で `"script"` から置き換え済み）。
  もし未反映なら Task 1 の完了を疑い、`"scene" | "audio" | "visual" | ...` になっているか確認してから進める。
- `ScriptData` インターフェースが残っている場合は削除し、`SceneData` を新規定義する
  （`sceneSchema.ts` に置き、`pipeline.ts` からは re-export のみ、または `pipeline.ts` に直接
  置いてもよい。**既存コードの `StageArtifact<TData>` ジェネリクスの型引数として使えれば場所は問わない**）。

関連:
- `packages/core/src/errors.ts` — `YanchaError` / `ErrorCode`。`validateScene` の失敗は
  **`ARTIFACT_INVALID`** を使う（`script.ts` 系列は `CLIENT_ERROR` だったが、こちらは
  「LLM出力がスキーマに合わない」なので意味が異なる。Task 0 の `generateJson` 内部の
  JSON抽出失敗は `CLIENT_ERROR`、**`validate` 関数自体が投げるものは `ARTIFACT_INVALID`**）。
- `src/clients/llm.ts` — Task 0 で追加された `generateJson<T>(request, validate)` と
  `LlmGenerateRequest.responseFormat` を前提にする。まだ存在しなければ実装せず、
  Task 0 未完了として作業を止める。
- `src/license.ts` — Task 1 で `appendLicenseEntry(videoDir, entry)` に置き換わっている前提。
  `AssetType` union に `"scene"` が含まれているか確認する。

## Global Constraints（計画から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示。
- **コメント・ログ・エラーメッセージは日本語。**
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。
- テストは vitest（globals 有効。`import { describe }` 等は不要）。
- **`Math.random()` / `new Date()` の直接使用を禁止**（seed駆動・決定論。設計 §4.1）。
  → `createdAt` のようなタイムスタンプが必要な場合は `script.ts` に倣い `new Date().toISOString()`
  を使ってよい（**既存コードの慣習を踏襲**。ただし `seed` や乱数用途では絶対に使わない）。
- 外部I/O（LLM呼び出し）は差し替え可能にしてモックする。**テストで実際のAPIを叩かない。**
- **P0スコープを超えない**（設計 §1 の非ゴール表）。`audio.preset` は `"rain"` 一択、
  `visual.preset` は `"particles"` 一択、シーンは1種のみ。
- コミットは日本語 `prefix: 要約`。`#21` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

```typescript
// src/stages/sceneSchema.ts

// 音レイヤー1本分の設定。プロシージャル合成（audio-synth）がそのまま読む値なので、
// 数値は全てレンジで縛る。実際のレンジ・キー構成は audio-synth の実装（Task 3）に合わせて
// 調整可（本タスクでは「音を壊さない形にする」ことが目的で、値自体は仮決めでよい）。
export interface AudioLayer {
  readonly kind: "rainCore" | "rainDistant" | "windLow"; // P0の雨1プリセットで使うレイヤー種別
  readonly gainDb: number;   // 範囲 -60〜0
  readonly cutoffHz: number; // 範囲 20〜20000
}

// 映像パラメータ。visual-synth（Task 4）がそのまま読む値。
export interface VisualParams {
  readonly particleCount: number;   // 範囲 10〜2000
  readonly particleSpeed: number;   // 範囲 0〜5
  readonly hueDegrees: number;      // 範囲 0〜360
  readonly loopSeconds: number;     // 範囲 5〜30（既定10。設計 §4.3の「短いループ」）
}

export interface SceneData {
  readonly sceneId: string;
  readonly title: string;
  readonly storyline: string;        // 説明欄に載せる短文（上位設計 §6.1）
  readonly durationSeconds: number;  // P0既定 60。範囲 10〜3600
  readonly seed: string;             // LLMには決めさせない。deriveSeedで導出（Step 3）
  readonly audio: {
    readonly preset: "rain";
    readonly layers: readonly AudioLayer[]; // 1件以上
  };
  readonly visual: {
    readonly preset: "particles";
    readonly params: VisualParams;
  };
}

// 純関数。LLM応答（unknown）を検証してSceneDataに絞り込む。
// preset外の値・レンジ外の数値・欠損フィールドは全て弾いて YanchaError("ARTIFACT_INVALID", ...) を投げる。
// 既定値へのフォールバックは絶対にしない（設計 §4.2）。
export function validateScene(value: unknown): SceneData;

// 上位設計 §6.1: 固有性マニフェスト。Task 7 の重複チェックが過去動画分と突き合わせて走査する。
export interface UniquenessData {
  readonly videoId: string;
  readonly seed: string;
  readonly audioPreset: string;
  readonly audioLayers: readonly string[]; // レイヤー構成の識別子列（例: layer.kind の配列）
  readonly visualPreset: string;
  readonly visualParams: Record<string, number | string>;
  readonly createdAt: string;
}
```

---

## Step 1: `SceneData` 型とバリデータ

`src/stages/sceneSchema.ts` に上記の型と `validateScene` を実装する。

- `validateScene(value: unknown): SceneData` は**純関数**。ネットワークI/O・ファイルI/Oを一切しない。
- チェック内容（すべて必須。1つでも欠けたらテストで検出できるように書く）:
  - トップレベルが object であること
  - `sceneId` / `title` / `storyline` が非空文字列であること
  - `durationSeconds` が数値で **10〜3600** の範囲であること
  - `audio.preset` が `"rain"` 以外を弾くこと（union外を確実にrejectする）
  - `audio.layers` が配列で **1件以上**、各要素の `kind` が `"rainCore" | "rainDistant" | "windLow"`
    のいずれか、`gainDb` が **-60〜0**、`cutoffHz` が **20〜20000** であること
  - `visual.preset` が `"particles"` 以外を弾くこと
  - `visual.params.particleCount` が **10〜2000**、`particleSpeed` が **0〜5**、
    `hueDegrees` が **0〜360**、`loopSeconds` が **5〜30** であること
  - `seed` フィールドは **LLM応答に含まれていてもいなくてもよい**（後述Step 3で
    ステージ側が上書きするため）。バリデータ自体は文字列であることだけ確認するか、
    無ければ空文字を許容してよい（呼び出し側で必ず上書きされる前提）。
- 検証失敗時は必ず `YanchaError("ARTIFACT_INVALID", ...)` を投げる。
  **メッセージにどのフィールドがどう不正だったかを日本語で含めること**（デバッグ用。
  Task 0 の `extractJson` がメッセージに元テキスト冒頭を含めたのと同じ思想）。
- **バリデーション失敗時に既定値へフォールバックしないこと**（設計 §4.2）。
  「LLMが変なJSONを返した」は落として人間が気付くべき事象（Task 0 の `generateJson` の
  設計思想と同じ）。

**テスト**（`tests/sceneSchema.test.ts`。必須ケース）:
- [ ] 正常な最小構成のJSONが通ること
- [ ] `audio.preset` が `"rain"` 以外 → `YanchaError`（`code` が `ARTIFACT_INVALID`）
- [ ] `visual.preset` が `"particles"` 以外 → `YanchaError`
- [ ] `durationSeconds` がレンジ外（例: 5、5000）→ `YanchaError`
- [ ] `visual.params.hueDegrees` がレンジ外（例: -1、361）→ `YanchaError`
- [ ] `audio.layers` が空配列 → `YanchaError`
- [ ] `audio.layers[].kind` が未知の値 → `YanchaError`
- [ ] 必須フィールド欠損（例: `title` なし、`storyline` なし）→ `YanchaError`
- [ ] トップレベルが配列・null・プリミティブ → `YanchaError`

## Step 2: プロンプト

`src/stages/scenePrompt.ts` に `buildScenePrompt(theme: ThemeData): string` と
システムプロンプト文字列（`sceneSystemPrompt` のような命名。`scriptPrompt.ts` の
`buildScriptPrompt` / `scriptSystemPrompt` の命名慣習に倣う）を実装する。

プロンプトに**必ず含める**:
- `theme.json` の内容（`title` / `keywords` / `tone` / `audience` 等、`ThemeData` にある情報）
- **スキーマの明示**: `SceneData` の形をプロンプト内にテキストで書き下す
  （フィールド名・型・意味）
- **preset一覧の明示**: `audio.preset` は必ず `"rain"`。`visual.preset` は必ず `"particles"`。
  `audio.layers[].kind` は `"rainCore" | "rainDistant" | "windLow"` のみ選択可、と明記する
- **数値レンジの明示**: Step 1 で決めた各フィールドのレンジをそのままプロンプトに書く
  （LLMがレンジ内に収めやすくするため。**ただしレンジ内に収まる保証はないので
  Step 1 のバリデーションは必ず独立して効かせる**）
- **効能表現を書かせない指示**: 「不眠が治る」「〇〇Hzで病気改善」等の断定的な健康効能を
  `storyline` / `title` に書かせない旨を明記する（CLAUDE.md の絶対原則）
- `seed` は**書かせない**（プロンプトに含めるフィールド一覧から `seed` を明示的に除外する。
  含めてしまうとLLMが独自の値を書いてきて、Step 3 の上書きと矛盾する説明になり紛らわしい）

`generateJson` は Task 0 の実装により `responseFormat: "json"` を要求できるので、
呼び出し側（Step 3）でそれを指定する。プロンプト内でも「JSONのみを出力し、説明文や
コードフェンスを前後に付けないこと」と念押しする（Task 0 の `extractJson` が保険として
効くが、プロンプト側でも防ぐのが筋）。

## Step 3: `SceneStage`

`src/stages/scene.ts` に `script.ts` の形を踏襲して実装する:

```typescript
export class SceneStage implements StageRunner {
  readonly id = "scene" as const;
  readonly outputFile = "scene.json";

  constructor(private readonly llmClient: LlmClient) {}

  async run(context: PipelineContext): Promise<StageArtifact<SceneData>> {
    // 1. theme.json を読む（script.ts と同じ形）
    const themeArtifact = await readJson<StageArtifact<ThemeData>>(join(context.videoDir, "theme.json"));

    // 2. プロンプトを組み立てて generateJson を呼ぶ
    const prompt = buildScenePrompt(themeArtifact.data);
    const scene = await this.llmClient.generateJson(
      {
        temperature: 0.7,
        responseFormat: "json",
        messages: [
          { role: "system", content: sceneSystemPrompt },
          { role: "user", content: prompt }
        ]
      },
      validateScene
    );

    // 3. seedはLLMに決めさせず、videoIdから決定論的に導出して上書きする（設計 §4.1）
    const seed = deriveSeed(context.videoId, "scene");
    const sceneWithSeed: SceneData = { ...scene, seed };

    // 4. scene.json を書き出す
    const artifact: StageArtifact<SceneData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: new Date().toISOString(),
      data: sceneWithSeed
    };
    await writeJson(join(context.videoDir, this.outputFile), artifact);

    // 5. uniqueness.json を書き出す（Step 4）

    // 6. license.json に追記する（appendLicenseEntry。全上書きしない）

    return artifact;
  }
}
```

注意点（`script.ts` からの差分として明示しておく）:
- **`generateJson` の第2引数に `validateScene` をそのまま渡す**。`generate` ではなく
  `generateJson` を使うこと（Task 0 の成果物）。
- `validateScene` が投げた `YanchaError("ARTIFACT_INVALID", ...)` は**そのまま伝播させる**
  （catchして握りつぶさない。Task 0 の `generateJson` の設計と同じ思想: 「LLMが変なJSONを
  返した」は落として人間が気付くべき事象）。
- `deriveSeed` は `@yancha/core`（Task 1 の成果物）からimportする。
  **`seed` はLLM応答の値を使わず、必ずこの導出値で上書きする**
  （Step 2で書かせない指示をしていても、LLMが値を含めてくる可能性があるため、
  バリデーション通過後に必ず上書きするコードを書くこと）。
- `appendLicenseEntry(context.videoDir, entry)` を呼ぶ。`entry.assetType` は `"scene"`。
  `writeLicenseJson` / `createInitialLicense`（全上書き系。Task 1で置き換わった旧API）は
  **使わない**。

## Step 4: `uniqueness.json` を出力（上位設計 §6.1）

Step 3 の `run` 内で、`scene.json` を書き出した直後に `uniqueness.json` も書き出す。

```typescript
// SceneDataから固有性マニフェストを組み立てる純関数として切り出す
// （scene.ts 内のプライベート関数でよい。Task 7 が読むのは uniqueness.json 自体であって
// この関数ではないため、exportは必須ではない）
function buildUniquenessData(videoId: string, scene: SceneData, createdAt: string): UniquenessData {
  return {
    videoId,
    seed: scene.seed,
    audioPreset: scene.audio.preset,
    audioLayers: scene.audio.layers.map((layer) => layer.kind),
    visualPreset: scene.visual.preset,
    visualParams: {
      particleCount: scene.visual.params.particleCount,
      particleSpeed: scene.visual.params.particleSpeed,
      hueDegrees: scene.visual.params.hueDegrees,
      loopSeconds: scene.visual.params.loopSeconds
    },
    createdAt
  };
}
```

`uniqueness.json` として `join(context.videoDir, "uniqueness.json")` に `writeJson` で書き出す
（`StageArtifact` でラップするかは任意。**Task 7 が `assets/*/uniqueness.json` を走査して
`UniquenessData` として読む**ことだけが契約なので、ラップせずそのまま `UniquenessData` を
トップレベルで書き出す形を推奨する。ラップする場合は Task 7 の実装時にその形を前提にできるよう、
本ファイル内で明確にコメントすること）。

`src/paths.ts` に `uniquenessJson` パスが既にある前提（Task 1 の成果物）。なければ
`join(context.videoDir, "uniqueness.json")` を直接組み立ててよい。

---

## `src/stages/index.ts` / `src/types/pipeline.ts` の配線

- `src/types/pipeline.ts`: `ScriptData` を削除し `SceneData` を使うようにする
  （`sceneSchema.ts` からimportして再export、または直接定義。**既存の `StageArtifact<TData>`
  ジェネリクスを壊さないこと**）。
- `src/stages/index.ts`: `"scene"` の位置に `PlaceholderStage` の代わりに
  `new SceneStage(llmClient)` を配線する。Task 1 で既に `StageId` 順序
  `theme → scene → audio → ...` に組み替わっている前提。順序自体はここでは変更しない。

---

## 完了の定義

- [ ] `validateScene` の純関数テスト（`tests/sceneSchema.test.ts`）が
      preset外・レンジ外・欠損フィールドの全パターンを弾くこと（Step 1のケース一覧を網羅）
- [ ] `tests/sceneStage.test.ts` で `SceneStage` が
      - `theme.json` を読み `generateJson` を正しい引数（`validateScene`・`responseFormat: "json"`）で呼ぶこと
      - `seed` がLLM応答値ではなく `deriveSeed(videoId, "scene")` の値で `scene.json` に記録されること
      - `uniqueness.json` が正しい内容で書き出されること
      - `appendLicenseEntry` が呼ばれ、`writeLicenseJson`（全上書き）が使われていないこと
      をモック `LlmClient` で検証していること（実LLM APIを叩かない）
- [ ] `pnpm build`（`tsc --noEmit`）が通る
- [ ] `pnpm test` が通る
- [ ] コミットメッセージが日本語で `#21` を紐付けている
