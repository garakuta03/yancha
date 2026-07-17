# Codex 指示書 — Task 9: `review` サマリ ＋ E2E通し（Issue #28）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 9 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §5.9・§1

## なぜこれをやるか / 位置づけ

Task 0〜8 で `theme → scene → audio → visual → video → metadata → checks → upload` の全ステージが実装済みになる。
残るのは最後の1段——**人間が最終確認するためのサマリ出力**と、**プレースホルダの撤去**、そして
**「コマンド一発で限定公開動画が1本出る」という P0 の出口条件を実地で証明すること**だけである。

**#28 は P0 全体の出口タスク。** これが終わればフェーズ0は完了し、フェーズ1（自動化・拡充）に進める。
依存: Task 8（#27, upload ステージ）。

設計 §5.8 で確定した通り、**Content IDクレームの有無はAPIで取得不可能**（パートナー限定APIであり
一般開発者には存在しないフィールド）。したがって上位設計 §6.4 の「公開前にContent IDクレームを確認する」
というゲートは自動化できず、**人間のチェックリストとして `review.md` に落とす**しかない（設計 §5.9）。
これが `review` ステージの存在理由であり、Web UIではなくテキスト出力で足りる理由でもある
（TODO.md「なくても可」）。

## スコープ

**やる:**
- `src/stages/review.ts`（`ReviewStage`）の新規実装。`review.md` を出力するだけ。
- `src/stages/placeholders.ts` と型 `PlaceholderData` の削除（全ステージが実装済みになったため不要）。
- `src/stages/index.ts` から `PlaceholderStage` の参照を除去し、`review` ステージを配列末尾に接続。
- `pnpm pipeline` の E2E を **3〜5回連続で通す**（手動実行。CI化はフェーズ1）。
- 1本あたりの生成時間・ボトルネックの計測記録。
- Issue へのコメント、`TODO.md` フェーズ0のチェック更新。

**やらない:**
- Web UI（サマリはMarkdownテキストのみで足りる。TODO.md「なくても可」）。
- 動画の公開（`publishAt` 予約投稿等）。**この段階の動画は限定公開のまま公開しない。**
- Content IDクレームの自動判定（API不可能と確定済み。§5.8）。人間のチェック項目として置くのみ。
- E2EのCI化・自動リトライ機構（手動実行で足りる。フェーズ1）。

## 現状（変更の起点）

現時点の `src/stages/placeholders.ts` / `src/stages/index.ts` / `src/types/pipeline.ts` は、
声なし方針への組み替え（Task 1）より**前**の朗読前提の状態のままである
（`StageId` が `theme/script/narration/music/audioMix/visual/video/metadata/humanReview/publish` で、
`PlaceholderStage` が `narration`/`music`/`audioMix`/`visual`/`video`/`metadata`/`humanReview`/`publish` の
8ステージ分インスタンス化されている）。

Task 1〜8 が完了すると、この状態は次のように変わっている前提で本タスクに着手する:

- `StageId` は `"theme" | "scene" | "audio" | "visual" | "video" | "metadata" | "checks" | "upload" | "review"` に
  組み替え済み（計画 Task 1 Step 1）。
- `theme`/`scene`/`audio`/`visual`/`video`/`metadata`/`checks`/`upload` の8ステージは
  それぞれ専用の `StageRunner` 実装（`ThemeStage`/`SceneStage`/`AudioStage`/`VisualStage`/`VideoStage`/
  `MetadataStage`/`ChecksStage`/`UploadStage`）に置き換わっている。
- `src/stages/index.ts` の `createStageRunners` は、実装済みステージを本実装で並べつつ、
  **`review` だけがまだ `PlaceholderStage` のまま**残っている（Task 1 Step 7 の方針：
  「未実装のものは `PlaceholderStage` のまま残す」を踏襲した結果、最後まで残るのが `review`）。
- `src/stages/placeholders.ts` の `PlaceholderStage` クラスと `src/types/pipeline.ts` の
  `PlaceholderData` 型は、この `review` 用の1エントリのためだけに存在している。

**本タスクの仕事は、この最後の1個の `PlaceholderStage("review", ...)` を本実装の `ReviewStage` に
置き換え、その結果不要になった `placeholders.ts` / `PlaceholderData` を削除すること**である。
着手時点で上記の前提が崩れている場合（＝ Task 1〜8 のいずれかが未完了、または `review` 以外にも
`PlaceholderStage` が残っている場合）は、**実装を進めず先に該当タスクを完了させること**。

関連:
- `src/license.ts` — `appendLicenseEntry`（Task 1 Step 4 で追記モデルに変更済みの前提）。
- `src/paths.ts` — `resolveVideoPaths`。`reviewMd` パスが Task 1 Step 8 で追加済みの前提。
- `src/stages/checks.ts` — `checks.json` を読み込んで結果一覧を作る際の参照元。
- `src/clients/youtube.ts` / `src/stages/upload.ts` — `upload.json` から動画URLを読む際の参照元。

## Global Constraints（計画から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示。
- **コメント・ログ・エラーメッセージは日本語。**
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。
- テストは vitest（globals 有効）。外部I/O（ファイルI/O以外の実行系）は差し替え可能にしてモック。
- **`Math.random()` / `new Date()` の直接使用を禁止**（seed駆動・決定論。設計 §4.1）。
  `ReviewStage` が `createdAt` 等の時刻を必要とする場合は、既存の `StageArtifact.createdAt` の
  扱い（他ステージと同じ注入方式）に倣うこと。**新規に `new Date()` を書かない。**
- **E2Eは手動**（`pnpm pipeline` を3〜5回回す）。CI化はフェーズ1（設計 §6）。
- **この段階の動画は公開しない**（限定公開のまま。TODO.md 常時ルール）。
- コミットは日本語 `prefix: 要約`。`#28` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

`review.md` の内容構成（Markdown。人間が読んで手作業でチェックを入れる前提）:

```markdown
# レビュー: <videoId>

## 動画（限定公開）
- URL: <upload.json の動画URL>
- videoId: <upload.json の videoId>

## 自動チェック結果（checks.json）
- 効能表現リンター: <pass/fail と違反一覧>
- uniqueness重複チェック: <pass/fail と重複先videoId一覧>
- ラウドネス検査: <pass/fail と測定LUFS>

## 人間確認チェックリスト（自動化できないもの）
- [ ] YouTube Studio で Content IDクレームの有無を目視確認（API不可のため唯一の手段）
- [ ] 目視での品質確認
- [ ] 逆画像検索（映像キーフレーム）
- [ ] AI開示フラグの要否判断（P0は常時ON。AI音楽を入れたら必須化）
- [ ] 効能表現の最終確認
```

`ReviewStage` の型:

```typescript
// review.md を組み立てて書き出すだけのステージ。判定ロジックは持たない
// （判定は checks ステージが既に済ませている。ここは集約と提示のみ）。
export class ReviewStage implements StageRunner {
  readonly id: "review";
  readonly outputFile: string; // "review.md"
  run(context: PipelineContext): Promise<StageArtifact<ReviewData>>;
}
```

`review.md` を生成する本体は**純関数**として分離し、`ReviewStage.run` から呼ぶこと
（`checks.json` / `upload.json` の中身 → Markdown文字列、というI/Oを持たない変換関数にすると
テストしやすい。例: `buildReviewMarkdown(opts: { videoId: string; uploadUrl: string; uploadVideoId: string; checks: ChecksData }): string`）。

`StageArtifact<ReviewData>` の `data` には最低限 `reviewMdPath` を含める
（他ステージの `StageArtifact` が成果物へのポインタを持つ既存慣習に倣う）。

## Step 1: `ReviewStage` の実装

1. `src/stages/review.ts` を新規作成。
2. `context.videoDir` から `checks.json` と `upload.json` を読み込む
   （`@yancha/core` の `readJson` 等、既存ステージが使っている読込ユーティリティに倣う）。
3. 上記「成果物インターフェース」のMarkdownを組み立てる純関数を書き、テスト可能にする。
   - `checks.json` の各チェック結果（効能表現リンター / uniqueness重複 / ラウドネス検査）を
     pass/fail と詳細つきで列挙する。
   - `upload.json` から限定公開URLと videoId を転記する。
   - 人間確認チェックリストは**固定文言**（上記5項目）。動的に増減させない
     （P0スコープ。増やすのはフェーズ1）。
4. `review.md` を `context.videoDir` に書き出す（`resolveVideoPaths` の `reviewMd` パスを使う）。
5. `license.json` への追記は**不要**（`review` は新規アセットを生まないため。licenseの対象は
   scene/ambient/visual/video/metadata の実体アセットのみ。設計 §5.4 の `AssetType` union に
   `review` が含まれていないことと整合させる）。

## Step 2: `placeholders.ts` と `PlaceholderData` の削除

1. `src/stages/index.ts` の `createStageRunners` から `PlaceholderStage` の import と
   `new PlaceholderStage("review", ...)` の行を削除し、`new ReviewStage()` に置き換える。
2. ステージ配列全体が Task 1 Step 1 で定めた実行順
   `theme → scene → audio → visual → video → metadata → checks → upload → review`
   になっていることを確認する（**順序がパイプラインの実行順を決める**。計画 Task 1 Step 1）。
3. `src/stages/index.ts` に他の `PlaceholderStage` の参照が残っていないことを確認したうえで、
   `src/stages/placeholders.ts` ファイルを削除する。
4. `src/types/pipeline.ts` から `PlaceholderData` 型と、それを参照している箇所
   （`StageArtifact<PlaceholderData>` 等）を削除する。
5. `pnpm build`（`tsc --noEmit`）を通し、削除に伴う型エラーが残っていないことを確認する。

## Step 3: E2Eを3〜5回回す（= P0の出口条件）

これは実装作業ではなく**実地確認**である。ローカル環境（Mac、CLAUDE.md「本運用まではMacだけで完結」）で
以下を行う。

1. `pnpm pipeline --video-id <id>` を**異なる videoId で3〜5回連続実行**し、全て最後まで
   （`review` ステージまで）通ることを確認する。
   - 失敗した場合は原因を特定し、コードを修正してから再実行する（何回目でどこで落ちたかを記録）。
2. **1本あたりの生成時間を計測し、ステージ別の内訳を記録する**
   （特に `visual` ステージがボトルネックになる想定。設計 §7.2 の実測「1080p/30fpsで約2.7fps、
   10秒ループ＝約2分」を参考に、実測値と比較する）。
3. `checks.json` が毎回 pass する（P0のE2Eは常に成功パスを通す想定。fail するケースの
   ハンドリング自体はTask 7で実装済みのはずなので、ここでは**正常系が安定して通ること**を検証する）。
4. **同一seedで同一出力になることを確認する**（決定論の最終検証。計画の「完了の定義」に対応）。
   同一 `videoId` を指定して2回実行し、`ambient.wav` / `visual-loop.mp4` がバイト一致すること、
   `scene.json` の `seed` フィールドが両者で一致することを確認する。
5. `license.json` を目視し、**全ステージ（scene/ambient/visual/video/metadata）のエントリが
   追記されている**こと（上書きされて1件しか残っていない、ということがないこと）を確認する。
6. 確認結果を GitHub Issue（`garakuta03/yancha` の #28）にコメントする
   （実行回数・成功/失敗・生成時間の内訳・ボトルネック・決定論確認結果を記載）。
7. `TODO.md` のフェーズ0の該当項目にチェックを入れる
   （出口条件: 「E2Eが安定して回る（3〜5回連続で通る）」「1本の生成時間・ボトルネックが把握できている」）。

## 完了の定義（P0全体の完了の定義。計画末尾より）

- [ ] `pnpm pipeline --video-id <id>` 一発で限定公開動画が1本上がる
- [ ] `pnpm build`（`tsc --noEmit`）と `pnpm test` が通る
- [ ] E2Eが3〜5回連続で通る
- [ ] 1本の生成時間・ボトルネックが記録されている
- [ ] 同一seedで同一出力になる（決定論の確認）
- [ ] `license.json` に全ステージのエントリが**追記されている**（上書きされていない）
- [ ] **この段階の動画は公開しない**（限定公開のまま。TODO.mdの常時ルール）
- [ ] `src/stages/placeholders.ts` と `PlaceholderData` が削除されている
- [ ] Issueにコメントし、`TODO.md` のフェーズ0にチェックが入っている
- [ ] コミットメッセージが日本語で `#28` を紐付けている