# Codex 投入プロンプト — フェーズ0 E2E MVP

> Codex に貼り付けて使う。plan が実装の唯一の入力であり、指示書の中間層は作らない
> （運用ルール: [CLAUDE.md](../../CLAUDE.md) §役割分担・ワークフロー）。
>
> 使い方: 下の「共通プロンプト」を最初に1回渡し、以後は「Task起動テンプレ」でTaskを1つずつ着手させる。
> 着手順は plan §Task の依存に従う。**Task 0（Issue #19、OPEN）から**。

---

## 共通プロンプト（最初に1回渡す）

```
あなたは yancha リポジトリ（睡眠/ヒーリングAI動画の自動生成パイプライン）の実装担当です。

## 実装の唯一の入力
- 実装計画: docs/superpowers/plans/2026-07-16-p0-e2e-mvp.md
- 判断根拠の設計: docs/superpowers/specs/2026-07-16-p0-e2e-mvp-design.md
  （plan が設計の§を参照している。実装前に該当§、特に設計§4「主要な設計判断」を読むこと）
- リポジトリ規約: CLAUDE.md
- ⚠️ plan 冒頭の「use subagent-driven-development…」は Claude 前提の定型文。無視してよい。

## 進め方
- 最初に Issue #19 が OPEN であることを確認し、Task 0 から着手する。
- plan の Task を1つずつ、依存順（各Taskの Files/Interfaces/Steps）に従って実装する。
- 各 Step のチェックボックスを埋めながら進める。plan と設計に書かれていないスコープを足さない
  （設計§1「非ゴール」を厳守。P0は 雨1プリセット・シーン1種・60秒・限定公開まで）。
- 不明点や、plan と現状コードの食い違いを見つけたら、勝手に補完せず報告する。

## Global Constraints（plan §Global Constraints を厳守）
- TypeScript ESM。import は拡張子 .js を明示。
- コメント・ログ・エラーメッセージは日本語。
- エラーは @yancha/core の YanchaError（code 付き）で送出。
- テストは vitest（globals 有効）。外部I/O（LLM・YouTube API・ffmpeg）は差し替え可能にしてモックし、
  テストで実APIを叩かない・実時間を待たない・実 ffmpeg を起動しない。
- Math.random() / new Date() / Date.now() の新規使用を禁止（seed駆動・決定論。設計§4.1）。時刻は注入する。
- ffmpeg・音声・映像の実行は単体テストしない。パラメータ→引数列の組み立てを純関数にしてテストする。

## 完了時のワークフロー（CLAUDE.md）
- feature ブランチを切り、ローカルで main にマージ（PRベースにしない）。
- コミットは日本語 `prefix: 要約`（feat/fix/docs/style/refactor/test/chore）。対応 Issue を `#番号` で紐付ける。
- マージ後 `git push` し、対応 Issue を更新/クローズする。
- 各 Task 完了時に `pnpm build`（tsc --noEmit）と `pnpm test` が通ることを確認する。

まず「Task 0」に着手してよいか、着手前に plan と設計の該当§を読んで実装計画を要約して提示してください。
```

## Task ↔ Issue 対応表

| plan Task | 内容 | Issue |
|---|---|---|
| Task 0 | LLMクライアント堅牢化（JSONモード・429リトライ・thinking応答） | #19 |
| Task 1 | パイプライン骨格の組み替え（StageId再構成・core追加・license追記） | #20 |
| Task 2 | scene ステージ | #21 |
| Task 3 | packages/audio-synth MVP | #22 |
| Task 4 | packages/visual-synth MVP | #23 |
| Task 5 | video ステージ | #24 |
| Task 6 | metadata ステージ | #25 |
| Task 7 | checks ステージ | #26 |
| Task 8 | upload ステージ | #27 |
| Task 9 | review サマリ ＋ E2E通し | #28 |

依存:
- Task 0（#19 OPEN）を最初に片付ける。
- Task 1（#20）は Task 0 後。
- Task 2（#21）は Task 0・1 後。
- Task 3（#22）と Task 4（#23）は Task 1 後に並行可。
- Task 5（#24）は Task 3・4 後。
- Task 6（#25）は Task 0・2 後。
- Task 7（#26）は Task 5・6 後。
- Task 8（#27）は Task 7 後。
- Task 9（#28）は Task 8 後。

## Task 起動テンプレ（Taskごとに渡す）

```
plan（docs/superpowers/plans/2026-07-16-p0-e2e-mvp.md）の「Task <N>」を実装してください。
共通プロンプトの Global Constraints とワークフローを厳守。対応 Issue は #<番号>。
着手前に、当該 Task の Files/Interfaces/Steps と、参照している設計§を読んで実装方針を1行で示してから始めてください。
```
