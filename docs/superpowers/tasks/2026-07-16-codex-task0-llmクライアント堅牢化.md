# Codex 指示書 — Task 0: LLMクライアントの堅牢化（Issue #19）

> **これはCodexへの実装指示書です。** 元計画: [フェーズ0 E2E MVP 実装計画](../plans/2026-07-16-p0-e2e-mvp.md) Task 0 /
> 設計: [フェーズ0 E2E MVP 設計](../specs/2026-07-16-p0-e2e-mvp-design.md) §4.1・§8 リスク1

## なぜこれを最初にやるか

P0の `scene` / `metadata` ステージは**LLMの構造化JSON出力に依存する**。現状の `LlmClient` は
`generate()` で生の文字列を返すだけで、リトライもJSONモードもない。ここが固まらないと
Task 2（scene）以降が全て砂上の楼閣になる。**#19 はP0全体のブロッカー。**

## スコープ

- **やる**: `src/clients/llm.ts` の堅牢化と `tests/llm.test.ts` の新規作成。
- **やらない**: ステージ側の改修（Task 1以降）。`scene.json` のスキーマ定義（Task 2）。
  プロバイダの追加。ストリーミング。トークン計測。

## 現状（変更の起点）

`src/clients/llm.ts`:
- `LlmClient` は `generate(request): Promise<LlmGenerateResponse>` のみ。
- `OpenAiLlmClient` / `GeminiLlmClient` / `MockLlmClient` の3実装。
- 非200は即 `YanchaError("CLIENT_ERROR", ...)`。**リトライなし。**
- `MockLlmClient` は朗読Markdownを返す（Task 1 で朗読ステージごと消える前提）。

関連:
- `packages/core/src/errors.ts` — `YanchaError` / `ErrorCode` union（`CLIENT_ERROR` を使う）
- `src/config.ts` — `AppConfig.llm`（provider / model / 各APIキー・ベースURL）

## Global Constraints（計画から継承。必ず守る）

- TypeScript ESM。import は拡張子 `.js` を明示。
- **コメント・ログ・エラーメッセージは日本語。**
- エラーは `@yancha/core` の `YanchaError`（code 付き）で送出。
- テストは vitest（globals 有効。`import { describe }` 等は不要）。
- **`Math.random()` / `new Date()` の直接使用を禁止**（seed駆動・決定論。設計 §4.1）。
  → **リトライのバックオフ待機に `Date.now()` を使わない。待ち時間は引数で注入可能にする**（下記 Step 1）。
- 外部I/O（`fetch`）は差し替え可能にしてモックする。**テストで実際のAPIを叩かない。**
- コミットは日本語 `prefix: 要約`。`#19` を紐付ける。
- feature ブランチ → ローカルで `main` にマージ → `git push` → Issue更新（CLAUDE.md）。

## 成果物インターフェース

```typescript
// 追加: JSON出力を要求できるようにする
export interface LlmGenerateRequest {
  readonly messages: readonly LlmMessage[];
  readonly temperature: number;
  readonly responseFormat?: "text" | "json";   // 既定は "text"（既存呼び出しを壊さない）
}

// 追加: LlmClient に生やす
export interface LlmClient {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
  generateJson<T>(request: LlmGenerateRequest, validate: (value: unknown) => T): Promise<T>;
}

// 追加: 純関数としてexportし、単体テストする
export function extractJson(text: string): unknown;
```

---

## Step 1: 429 / 5xx リトライ

指数バックオフ（1s / 2s / 4s、**最大3回リトライ**＝最大4回試行）。

- `Retry-After` ヘッダがあれば**それを優先して尊重する**（秒数形式のみ対応でよい。HTTP-date形式は無視して指数バックオフにフォールバック）。
- リトライ対象: **429 と 5xx のみ**。
- **429以外の4xx は即** `YanchaError("CLIENT_ERROR", ...)`（リトライしても無駄なので待たせない）。
- リトライ枯渇時も `YanchaError("CLIENT_ERROR", ...)`。**最後の応答のstatusを含む日本語メッセージにすること。**
- リトライ時は `Logger` で warn を出す（何回目・何秒待つか）。

### ⚠️ 決定論の制約をここで踏まないこと

`Math.random()`（ジッター）と `Date.now()` は**禁止**（Global Constraints）。
バックオフは**固定の指数**とし、**待機関数を注入可能にする**:

```typescript
// テストでは即座に解決する関数を渡し、実時間を待たせない
export interface LlmClientDeps {
  readonly fetchFn?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}
```

`createLlmClient(config, deps?)` で受ける。**既定は実 `fetch` と実 `setTimeout`。**
これがないとテストが7秒待つことになる。

## Step 2: JSONモード

`responseFormat: "json"` のとき、プロバイダ側にJSON出力を要求する:

- **Gemini**: `generationConfig.responseMimeType = "application/json"`
- **OpenAI**: `response_format: { type: "json_object" }`

`responseFormat` 省略時（= `"text"`）は**現在のリクエストボディと完全に同じものを送ること**。
既存の呼び出しの挙動を変えない。

## Step 3: thinkingモデル応答・コードフェンスへの耐性

**JSONモードを指定してもテキストが混ざることがある**（設計 §8 リスク1）。
応答テキストからJSONを抽出する**純関数**を作る:

```typescript
// LLM応答テキストからJSON部分を取り出してパースする。
// JSONモードでも前置きやコードフェンスが混ざる場合があるため、素のJSON.parseに頼らない。
export function extractJson(text: string): unknown;
```

処理:
1. ` ```json ... ``` ` / ` ``` ... ``` ` フェンスがあれば中身を取り出す
2. フェンスがなければ、**最初の `{` から最後の `}` まで**を取る（thinkingモデルの前置き対策）
3. `JSON.parse` する
4. パース失敗は `YanchaError("CLIENT_ERROR", ...)`。**元テキストの冒頭を切り詰めてメッセージに含める**（デバッグ用）

**この関数を単体テストする**（必須ケース）:
- [ ] フェンスなしの素のJSON
- [ ] ` ```json ` フェンス付き
- [ ] 言語指定なし ` ``` ` フェンス付き
- [ ] thinkingモデルの前置きテキスト + JSON
- [ ] 前置き + フェンス付きJSON（両方混在）
- [ ] 壊れたJSON → `YanchaError` が飛ぶこと（code が `CLIENT_ERROR` であることまで確認）
- [ ] JSONが1つも含まれない文字列 → `YanchaError`

### `generateJson<T>`

`generate({...request, responseFormat: "json"})` → `extractJson` → `validate(value)` の順。
**`validate` が投げた場合はそのまま伝播させる**（呼び出し側の Task 2 が `YanchaError("ARTIFACT_INVALID")` を投げる設計）。
**既定値へのフォールバックを絶対に入れないこと**（設計 §4.2）。

> **設計上の注意**: `validate` の失敗でリトライしない。P0はスコープ外。
> 「LLMが変なJSONを返した」は落として人間が気付くべき事象。

## Step 4: `MockLlmClient` の JSON 対応

`responseFormat: "json"` のとき、現状の朗読MarkdownではなくJSONを返す。

- **返すのは Task 2 の `scene.json` スキーマに沿ったJSON**（設計 §5.2）。
  ただし Task 2 未着手のため、**この時点では設計 §5.2 のスキーマを見て手で書いた固定JSONでよい**。
  型を Task 2 の `SceneData` に依存させないこと（循環参照になる）。
- **`Math.random()` を使わない**。固定値または `videoId` から決定論的に導出する。
- 朗読Markdown（`responseFormat` 省略時）は**このタスクでは残す**。Task 1 で朗読ステージごと消える。

## 完了の定義

- [ ] `pnpm build`（`tsc --noEmit`）が通る
- [ ] `pnpm test` が通る
- [ ] `tests/llm.test.ts` が Step 3 の必須ケースを全て網羅している
- [ ] **テストが実APIを叩かない・実時間を待たない**（`fetchFn` / `sleep` 注入で確認）
- [ ] 既存の `generate()` 呼び出し（`src/stages/script.ts`）が**挙動を変えずに動く**
- [ ] `Math.random()` / `new Date()` / `Date.now()` を新規に使っていない
- [ ] コミットメッセージが日本語で `#19` を紐付けている
