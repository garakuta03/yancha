# 設計ドキュメント — フェーズ0: E2EパイプラインMVP（形を作る）

- 日付: 2026-07-16
- ステータス: ドラフト（レビュー待ち）
- 対応Issue: #7（分解する）/ #12 / #19 を前提に含む。新規Issueは §9 参照
- 上位方針: [ノーボイス全生成・VPS配信基盤設計](../../design/2026-07-16-ノーボイス全生成・vps配信基盤設計.md)
- ロードマップ: [TODO.md](../../../TODO.md) — **フェーズ区分は TODO.md を正とする**（下記 §0 の注意）

---

## 0. 前提の食い違いについて（先に潰す）

上位設計 §7 の「フェーズ0 = ニッチ検証」は、TODO.md の再編（フェーズP = 準備・観測開始 /
フェーズ0 = E2E MVP）より**古い**。本スペックは **TODO.md の定義を採用**する。

- ニッチ検証（research の discover/collect 運用）は **フェーズP** として本スペックと**並行**で走る。
  パイプライン構築をブロックしない。
- したがって **本スペックはニッチを未定のまま進める**。上位設計 §3 の結論
  「3候補とも中身はシーン特化アンビエンスであり、生成エンジン・パイプラインは共通。
  ニッチはその上のパッケージング差でしかない」がこれを許す。
  → **P0で作るのはエンジンであり、ブランドではない。**

**上位設計 §7 の改訂が必要**（別Issue）。本スペックはその改訂を待たない。

## 1. 目的 / ゴール

**「コマンド一発で、限定公開の完成動画が1本出る」状態を作る。品質は問わない。**

```bash
pnpm pipeline --video-id <id>   # → YouTube に限定公開の動画が1本上がり、レビュー用サマリが出る
```

### 出口条件（TODO.md フェーズ0の出口）

- E2Eが安定して回る（3〜5回連続で通る）
- 1本の生成時間・ボトルネックが把握できている

### 非ゴール（やらないことを明示する＝YAGNI）

| やらないこと | 理由 / どのフェーズか |
|---|---|
| 音・映像のプリセット拡充（雨以外、シーン2種目以降） | フェーズ1。P0は**雨1・シーン1**のみ |
| 公開（`publishAt` 予約投稿） | フェーズ1。P0の動画は**限定公開で止める**（品質バー未達のため） |
| サムネ3案・チャプター自動生成 | フェーズ1。P0はサムネ1案でよい |
| ニッチ確定・ブランド設計・自社IP | フェーズP/1の壁打ち事項 |
| BGM（メロディのある音楽）・Stable Audio | フェーズ2。P0は**環境音のみ**（人間の編曲工程が要るため、P0の自動E2Eに含めない） |
| ComfyUI / 静止画生成 / GPUノード | フェーズ1。P0は**プロシージャルのみ**（第1層で足りる） |
| 配信用セグメント出力 | フェーズ3 |
| レビューWeb UI | サマリのテキスト出力で足りる（TODO.md「なくても可」） |
| 長尺 | §4.3 参照。P0は**60秒**で回す |

## 2. 不変原則との整合

| 原則 | P0での担保 |
|---|---|
| 完全オリジナル・自社ライセンス | 生成は**第1層（プロシージャル）のみ**。コードとパラメータを人間が書く＝著作権主張可。LLMはテキスト（scene/metadata）のみに使う |
| ライセンス証跡 | 既存 `license.json` を全ステージが追記する形に拡張（現状は script ステージが**上書き**していて壊れている。§5.4） |
| 固有性の機械的保証 | `uniqueness.json` ＋ 過去動画との重複チェック（§5.6） |
| 効能断定なし | 既存 `scriptPolicy.ts` を**メタデータに適用**（§5.4） |
| 人間レビュー必須・公開ボタンは人間が押す | パイプラインは**限定公開で止まる**。公開はフェーズ1でも人間操作 |
| 低品質段階の動画は公開しない | P0の出力は全て限定公開。E2E検証用であり公開しない |
| AI開示トグルON | upload時に固定でON（§5.8） |

## 3. アーキテクチャ全体像

### 3.1 パッケージ構成

```
yancha/                     ルートパッケージ = オーケストレーション（既存 src/）
├── src/stages/             各ステージ。audio-synth / visual-synth を呼ぶ薄い層
├── packages/core/          既存。Logger / YanchaError / readJson,writeJson
├── packages/research/      既存。フェーズPで並行運用（P0では触らない）
├── packages/audio-synth/   ★新規。環境音プロシージャル合成 → WAV
└── packages/visual-synth/  ★新規。three.jsヘッドレス → 完全ループMP4
```

**audio-synth / visual-synth は「ステージ」を知らない**。純粋な `(params, seed) → ファイル` の
ライブラリ＋CLIにする。理由: 単体実行・単体テスト可能にする方針（CLAUDE.md）＋
フェーズ3で配信セグメント生成から**同じエンジンを別文脈で呼ぶ**ため。

### 3.2 ステージ再構成

現状のステージ列は**朗読前提**（`script`/`narration`/`music`/`audioMix`）で、声なし方針と噛み合わない。
組み替える。

| 現状 | P0後 | 扱い |
|---|---|---|
| `theme` | `theme` | 維持（中身は差し替え。§5.1） |
| `script` | `scene` | **転用**。theme.json → LLM → scene.json + uniqueness.json |
| `narration` | — | **削除**（声なし方針） |
| `music` | — | **削除**（BGMはフェーズ2） |
| `audioMix` | `audio` | **置換**。scene.json → audio-synth → ambient.wav |
| `visual` | `visual` | 実装。scene.json → visual-synth → visual.mp4 |
| `video` | `video` | 実装。ffmpeg合成＋ラウドネス正規化 → final.mp4 |
| `metadata` | `metadata` | 実装。LLM → metadata.json |
| — | `checks` | **新規**。効能リンター / uniqueness重複 / ラウドネス検査 |
| `humanReview` | `review` | 置換。チェック結果＋動画リンクのサマリ出力 |
| `publish` | `upload` | 実装。限定公開アップロード（Content IDスキャン確認まで） |

**新しい順序**（上位設計 §6.4「公開前ゲート」に従う。**限定公開アップロードは人間レビューの
"前"** — Content IDクレーム有無を人間が見るため）:

```
theme → scene → audio → visual → video → metadata → checks → upload → review
                 └─ audio-synth ┘        └ ffmpeg ┘   └ 自動 ┘  └限定公開┘  └人間ゲート┘
```

### 3.3 成果物（`assets/<video_id>/`）

| ファイル | 生成ステージ | 備考 |
|---|---|---|
| `theme.json` | theme | 人手編集も可 |
| `scene.json` | scene | 世界観・Storyline・音レイヤー・映像パラメータ・尺 |
| `uniqueness.json` | scene | 固有性マニフェスト |
| `ambient.wav` | audio | 環境音（P0は雨のみ） |
| `visual.mp4` | visual | 完全ループ・映像のみ |
| `final.mp4` | video | 映像×音声・ラウドネス正規化済み |
| `metadata.json` | metadata | タイトル・説明・タグ・サムネ案 |
| `checks.json` | checks | 自動チェック結果 |
| `upload.json` | upload | videoId・URL・Content IDスキャン結果 |
| `review.md` | review | 人間が読むサマリ |
| `license.json` | 全ステージが追記 | 証跡 |
| `logs/` | 全ステージ | 生成ログ（プロンプト・seed・バージョン） |

## 4. 主要な設計判断

### 4.1 seed駆動・決定論を最初から入れる

`videoId` から seed を導出し、audio/visual 双方に渡す。同じ seed → 同じ出力。

- **理由1**: `uniqueness.json` に記録して重複をCIで機械チェックする（上位設計 §6.1）ため、
  seedが出力を決めていないと固有性の証明にならない。
- **理由2**: E2Eを3〜5回回して壊れる箇所を潰す（P0の出口条件）とき、再現性がないとデバッグ不能。
- **やり方**: seed は scene.json に記録。`Math.random()` を**使わない**（決定論PRNGを core に置く。§5.0）。

### 4.2 LLMは scene と metadata のみ。音・映像はLLMに触らせない

scene.json は「世界観・Storyline・音レイヤー構成・映像パラメータ」を含むが、
**LLMが出すのはパラメータの"選択"であって信号ではない**。プリセット名と数値レンジを
スキーマで縛り、範囲外は落とす。理由: 第1層（プロシージャル）の著作権主張可という性質を
LLMに汚させないため＋LLMの自由記述が音を壊すのを防ぐため。

### 4.3 尺とレンダリングコストを分離する（実測に基づく最重要の構造）

**実測（GPUなしLinux・1080p/30fps・SwiftShader）: 毎フレーム描画は約1.9fps。**

| 尺 | 毎フレーム描画した場合 |
|---|---|
| 60秒 | 約11分 |
| 10分 | **約1.9時間** |
| 1時間 | **約11時間** |

→ **長尺を毎フレーム描画するのは原理的に不可能。** アンビエンス動画は長尺が前提なので、
これは「後で最適化する」話ではなく**最初から構造を決める話**である。

**構造: 短いループを1回だけ描き、ffmpeg `-stream_loop` で尺まで伸ばす。**

- `visual-synth` が出すのは `visual-loop.mp4`（**loopSeconds、既定10秒**）であって尺全体ではない。
- `video` ステージが `-stream_loop` で `durationSeconds` まで伸ばして音声と合成する。
- **レンダリングコストが尺から完全に独立する**（10秒ループ＝約2分。尺が1時間でも変わらない）。
- scene.json は `durationSeconds`（既定60）と `visual.loopSeconds`（既定10）を**別々に持つ**。

音響は事情が違う（プロシージャルなノイズ合成はCPUが安い）ため、**尺全体をレンダリングする**。
ただしチャンク単位（設計 §5.3）でメモリに全サンプルを載せない。

**P0の尺は60秒**（E2Eを3〜5回回すのが出口条件のため。TODO.mdは尺を指定していない）。
上記の構造により、**フェーズ1で長尺にするコストはほぼゼロ**。

### 4.4 upload はチャンネル開設をブロッカーにしない

YouTubeチャンネルは**未開設**（フェーズPのタスク）。upload ステージはチャンネルなしでは動かない。

→ `--dry-run` を用意し、**upload以外のE2Eをチャンネル開設前に完成**させる。
`dry-run` はアップロード直前のリクエストボディを `upload.json` に書いて終わる。

これによりフェーズPのチャンネル開設と本スペックの実装が並行できる。

### 4.5 認証: research（APIキー）と upload（OAuth2）は別物

既存 `packages/research` は APIキー（公開データ読取）。**`videos.insert` は OAuth2 必須**
（ユーザー同意・refresh token）。混ぜない。

- 新規env: `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN`
- スコープは **`youtube.upload` のみ**（最小権限。`youtube` はアカウント管理全般で広すぎる）
- refresh token 取得用に `pnpm pipeline auth` サブコマンド。
  **redirect_uri は `http://127.0.0.1:<port>`**（ローカルループバック）。
  ⚠️ **OOB（`urn:ietf:wg:oauth:2.0:oob`）は2023-01-31に完全廃止**。カスタムURIスキームも不可。
- **クォータは設計不要**（YAGNI）: `videos.insert` は **1コール=1ユニット・専用バケット・既定100本/日**。
  P0は5〜10本。ここに工数を割かない。
  - 旧情報（1600ユニット＝1日6本）は**2025-12-04と2026-06-01の2度の改定で失効済み**。
    記事が大量に残っているので参照しないこと。
  - 2026-06-01から `search.list` も専用バケットになったため、**research の discover とは
    クォータを食い合わない**。

### 4.6 YouTube API クライアントは素のREST + fetch にする

`googleapis` npm（173.0.0 / 2026-05-28 / **CJSのみ** / 依存ツリーが大きい）を引き込む利得が薄い。
使うのは実質 `videos.insert` 1本 ＋ OAuth のみ。

- **認証のみ `google-auth-library`**、アップロードは **resumable upload protocol を直接叩く**。
- 既存の `LlmClient` / `packages/research` も素の `fetch` で書かれており、一貫する。
- 副次的利得: `googleapis` の `fs.createReadStream()` で `videos.insert` がハングする既往issueを回避できる
  （2017年の古い報告で現行版の再現は未確認だが、避けられるなら避ける）。

## 5. コンポーネント設計

### 5.0 `@yancha/core` への追加

| 追加 | 理由 |
|---|---|
| `createRng(seed: string)` | 決定論PRNG（xorshift等）。`Math.random()` 禁止の受け皿（§4.1） |
| `deriveSeed(videoId, purpose)` | `videoId` から用途別seedを導出（audio用/visual用を分離） |
| `runFfmpeg(args, options)` | ffmpeg 子プロセス実行の共通化（audio-synth/visual-synth/video ステージが使う） |

`runFfmpeg` を core に置く理由: 3箇所で必要になり、エラーハンドリング（stderr回収・
非0終了の `YanchaError` 化）を重複させたくないため。

### 5.1 `theme` ステージ

現状はハードコードされた睡眠テーマ。P0では:
- `theme.json` が既にあれば**読むだけ**（人手編集を許す）。なければ既定値を書く。
- 既定値をニッチ非依存の汎用シーン（例: 「雨の夜」）に差し替え。
- `format` の union を `sleep-guide | healing-visual | sleep-story` から
  **`ambience`** 単一へ（声なし方針。朗読フォーマットは消える）。

### 5.2 `scene` ステージ（`script` の転用）

theme.json → LLM → `scene.json` + `uniqueness.json`。

scene.json スキーマ（案）:
```typescript
interface SceneData {
  readonly sceneId: string;
  readonly title: string;
  readonly storyline: string;          // 説明欄に載せる短文（上位設計 §6.1）
  readonly durationSeconds: number;    // P0既定 60
  readonly seed: string;
  readonly audio: {
    readonly preset: "rain";           // P0は雨のみ。unionで縛る
    readonly layers: readonly AudioLayer[];
  };
  readonly visual: {
    readonly preset: "particles";      // P0は1シーンのみ
    readonly params: VisualParams;     // 数値レンジをスキーマで縛る
  };
}
```

**LLMに構造化出力させる**ため、`LlmClient` にJSONモードが要る（§8のリスク・Issue #19）。
バリデーション失敗時は既定パラメータへフォールバックせず**落とす**（P0は形を作る段階であり、
黙って劣化させると壊れた箇所が見えなくなるため）。

### 5.3 `packages/audio-synth`（新規）

- **入力**: `{ preset, layers, durationSeconds, seed }` → **出力**: `ambient.wav`
- P0スコープ: **雨1プリセット**のみ。
- チャンクレンダリング（N秒単位）→ ffmpeg concat。理由: 長尺化しても
  メモリに全サンプルを載せない構造を最初から作るため（§4.3）。
- **技術: 依存ゼロのTypeScript実装**（§7.1 で確定）。PRNG（core の `createRng`）＋
  ノイズ＋ワンポールフィルタ＋WAVヘッダ手書き。

### 5.4 `license.json` の追記モデル（既存バグの修正を含む）

⚠️ **現状 `writeLicenseJson` は毎回ファイルを丸ごと上書きする**。
[script.ts](../../../src/stages/script.ts) が `createInitialLicense(...)` で
1エントリだけ書くため、後続ステージが同じ関数を呼ぶと**先行エントリが消える**。
証跡主義（上位設計 §6.3）が成立していない。

→ `appendLicenseEntry(videoDir, entry)`（読込→追記→書込）に変更。
`assetType` union も声なし方針に合わせる: `narration`/`music` を削除、`scene`/`ambient` を追加。

### 5.5 `packages/visual-synth`（新規）

- **入力**: `{ preset, params, loopSeconds, seed }` → **出力**: `visual-loop.mp4`
  （**尺全体ではなくループ素材**。§4.3）
- P0スコープ: **1シーン**（パーティクル＋グラデーション）、**完全ループ**、**非フォトリアル**。
- 完全ループの担保: パーティクルの位相を `loopSeconds` で割り切れる周期にする（末尾フレーム＝先頭フレーム）。
- **技術: Puppeteer + headless Chrome + SwiftShader**（§7.2 で確定）。
  `page.screenshot` → 連番PNG → ffmpeg。

#### ⚠️ 「静かな失敗」を assert で潰す（実測で判明した最大の罠）

SwiftShaderのフラグを1つでも落とすと、**例外も出ず、`WebGLRenderer` の生成も成功し、
`getParameter(VERSION)` は `WebGL 2.0` を返したまま、真っ白なフレームが出力される**
（実測: フラグなし → 全フレーム同一の1,822B・輝度YAVG=234.97）。
CIでも人間の目でも気付きにくい。

→ **`visual-synth` はレンダリング直後に自分で輝度・分散を検査して落とす。**
（`checks` ステージではなく `visual-synth` 側。原因の近くで落とすため）
ffmpeg `signalstats` の YAVG が閾値外／フレーム間の分散がゼロなら `YanchaError`。

### 5.6 `checks` ステージ（新規）

`checks.json` に結果を集約。**1つでも fail ならパイプラインを止める**（upload に進まない）。

| チェック | 内容 | 実装 |
|---|---|---|
| 効能表現リンター | metadata（タイトル・説明・タグ）にNG辞書を適用 | 既存 `scriptPolicy.ts` を `policy.ts` へ改名・転用。NG辞書は据え置き（拡充はフェーズ1） |
| uniqueness重複 | `assets/*/uniqueness.json` を走査し、同一seed・同一パラメータ列の再利用を検出 | 新規。P0は**完全一致のみ**（類似度判定はフェーズ1） |
| ラウドネス検査 | final.mp4 が -20〜-16 LUFS に入っているか | ffmpeg `ebur128` で測定して範囲判定 |

### 5.7 `video` ステージ

ffmpeg で `visual.mp4` × `ambient.wav` → `final.mp4`。
ラウドネス正規化は **loudnorm 2パス**（1パス目で測定 → 2パス目で適用）。
理由: 1パスだとターゲット LUFS への収束が保証されず、直後の `checks` のラウドネス検査と矛盾するため。

### 5.8 `upload` ステージ

- `videos.insert`（`part=snippet,status` / `status.privacyStatus: "unlisted"`）
- **AI開示フラグを常にON**: `status.containsSyntheticMedia = true`（**API設定可能**。
  2024-10-30にAPI追加済み）。`status.selfDeclaredMadeForKids` とは**別物**（両方 `status` 配下だが独立）。
- `--dry-run` 対応（§4.4）

> **補足: P0の動画は公式基準では開示"不要"側の可能性が高い。**
> 公式ヘルプの開示不要例に「Production assistance（生成AIで台本・タイトル・サムネを作る）」
> 「非現実的な内容」が明示されており、P0（プロシージャル生成＋非フォトリアル＋LLMはテキストのみ）は
> ここに該当する。開示が明確に必要なのは「**AI generated music**」「実在の場所のリアルな追加映像」等。
> → ただし**上位設計の「AI開示トグルは常にON」原則を維持する**。公式にラベル自体の不利益は
> 否定されており、安全側に倒すコストがゼロのため。フェーズ2でAI音楽（Stable Audio）を入れると
> **開示が明確に必須**になる。

#### ⚠️ Content IDクレームの確認は自動化できない（確定）

**YouTube Data API v3 に Content IDクレームを報告するフィールドは存在しない**。
Content ID API は**パートナー限定**で一般開発者は利用不可。代用候補は全て使えない:

| 候補 | 実際の意味 |
|---|---|
| `contentDetails.licensedContent` | パートナーにリンクされたチャンネルの動画かどうか。第三者クレームの有無ではない |
| `status.license` | `youtube`/`creativeCommon` の2値。投稿者が選ぶライセンス種別 |
| `suggestions` part | トランスコード品質のヒントのみ |

さらに悪いことに、**Content IDクレームは動画を拒否せず収益化を横取りするだけ**なので、
`uploadStatus` は `processed` のまま＝**API経由では成功と区別がつかない**。
（`status.rejectionReason` に `claim`/`copyright` はあるが、動画が拒否された場合のみ）

→ **`upload.json` にクレーム情報は書けない。`review.md` の手動確認項目に落とす**（§5.9）。
上位設計 §6.4「限定公開アップロード→Content IDクレーム有無を確認」は**人間の作業として残る**。

### 5.9 `review` ステージ

`review.md` を出力するだけ（Web UIは作らない）:
- 動画URL（限定公開）
- checks.json の結果一覧
- **人間が確認する項目のチェックリスト**（自動化できないもの）:
  - [ ] **YouTube Studio で Content IDクレームの有無を目視確認**（§5.8。API不可のため唯一の手段）
  - [ ] 目視での品質確認
  - [ ] 逆画像検索（映像キーフレーム）
  - [ ] **A/S開示フラグの要否判断**（P0は常時ON。AI音楽を入れたら必須化）
  - [ ] 効能表現の最終確認

## 6. テスト方針

- 既存に倣い vitest。外部I/O（LLM・YouTube API）は差し替え可能な形にしてモック。
- **ffmpeg・音声・映像の実行は単体テストしない**（実行時間・環境依存）。代わりに:
  - audio-synth / visual-synth は**パラメータ→ffmpeg引数列**の組み立てを純関数にしてテスト
  - 決定論PRNG・seed導出・uniqueness重複判定・効能リンター・scene.jsonバリデーションは純関数としてテスト
- **E2Eは手動**（`pnpm pipeline` を3〜5回回す）。CI化はフェーズ1。

## 7. 技術選定（実機検証で確定）

上位設計 §2 は Elementary Audio（音）/ three.js ヘッドレス（映像）を指定していた。
**GPUなしLinux実機で全候補を実際に動かして検証**し、以下に確定する。

> 検証環境: Node **v26.5.0** / Chrome 150 / three 0.185.1 / puppeteer 25.3.0 / GPUなし。
> ⚠️ **本プロジェクトの要件は Node >=20 だが、検証機は Node 26。Node 20/22 での動作は未確認。**
> Mac（M2 Max / arm64）での動作も未確認。

### 7.1 音: **依存ゼロのTypeScript実装**（Elementary を採用しない）

| 候補 | 実測結果 | 判定 |
|---|---|---|
| **依存ゼロ実装** | **105行**で雨音を実装・WAV出力・seed再現性bit一致まで確認 | ✅ **採用** |
| `@elemaudio/core` + `@elemaudio/offline-renderer` | Node で動作しseed決定論も確認。MIT・WASM（ネイティブビルド不要） | ❌ 見送り |
| `node-web-audio-api@2.0.0` | 動作確認・prebuilt同梱・Mac/Linux両対応・**最もメンテが新しい**（2026-05-23） | 将来の第一候補 |

**Elementary を採用しない理由**: 雨音1プリセット（＝フィルタ付きノイズ）という要件に対し、
wasm 数MB＋独自DSLの学習コストが見合わない。**105行で足りることが実証されている。**

**副次的だが重要な利得**: 依存ゼロなら上位設計 §2 第1層の
「**コードとパラメータを人間が全て書く＝生成物に著作権を主張できる**」が最も強く担保される。
これはこのプロジェクトの中核原則であり、ライブラリ経由より望ましい。

**将来の乗り換え先**: DSPグラフが複雑化したら `node-web-audio-api@2.0.0`
（Elementaryより新しく、prebuiltでMac対応、Web Audio の知識が使える）。

> ⚠️ **Elementary を将来使う場合の罠**: `latest` dist-tag が**古いバージョンを指している**
> （`npm i @elemaudio/core` → 2024-12版の 4.0.1 が入り、2025-09版の 4.0.3 は入らない）。
> `@next` 指定とバージョン固定が必須。

> 💡 **依存ゼロの実コスト（実証で判明）**: 検証実装は `peak=1.0000` ＝ **クリッピングしていた**。
> DSPを手書きするとゲインステージングを自分で詰める必要がある。雨音程度なら本質的な難所ではないが、
> **audio-synth に peak/RMS の自動検査を入れる**こと（§5.3 / Task 3）。

### 7.2 映像: **Puppeteer + headless Chrome + SwiftShader**（headless-gl を採用しない）

**SwiftShaderフラグの明示が必須**（§5.5 の「静かな失敗」）:
```
--use-gl=angle  --use-angle=swiftshader-webgl  --enable-unsafe-swiftshader
```
- 正しい値は **`swiftshader-webgl`**（`swiftshader` ではない）。
- Chrome 150 で**自動SwiftShaderフォールバックは削除済み**。フラグなしは白画面になる。
- `--enable-unsafe-swiftshader` はGPUプロセス内JITのセキュリティリスクを伴う。
  **自前コンテンツのみ描画するため許容**（外部HTMLを読ませないこと）。

**決定論性: 確認済み**。ブラウザプロセスを立ち上げ直して2回実行 → 10/10フレームがバイト一致
（SwiftShader＝CPUレンダリングのため）。§4.1 の要件を満たす。

**性能: `page.screenshot` が最速**（直感に反する実測結果）:

| 方式 | ms/frame | fps |
|---|---|---|
| 描画のみ | 55.8 | 17.9 |
| 描画 + **`page.screenshot`（PNG）** | **371.6** | **2.69** |
| 描画 + `readPixels`→base64→ffmpeg | 517.2 | 1.93 |

「生フレームを直接ffmpegにパイプする方が速い」は**誤り**。CDP越しのbase64転送コストが
PNGエンコードより高い。→ **`page.screenshot({optimizeForSpeed: true})` + ffmpeg連番読み込み**。

**`headless-gl`（npm `gl`）を採用しない理由**:
- 通説2件は**誤り**だった（「メンテ停止」→ 実は 9.0.0-rc.10 が 2026-04-10 公開。
  「WebGL2非対応」→ 実は `createWebGL2Context: true` あり）。
- **しかし実測で失格**: GPUなしヘッドレス機で
  `Could not open the default X display` → コンテキスト生成が `null`。**xvfb必須**。
  Puppeteerが素で動く以上、xvfb依存を足す理由がない。
- 安定版 8.1.6 は依存に high severity 脆弱性5件。

**その他の実装上の必須事項**（実測でハマった点）:
- **`requestAnimationFrame` で駆動しない**。壁時計時間に依存して非決定論になる。
  → **フレーム番号を引数に取る関数を `page.evaluate` から呼ぶ**（`window.__renderFrame(i)`）。
- three を ESM で使うため **importmap が必要 → `file://` 不可。ローカルHTTP配信が要る。**
- `--no-sandbox` / `--disable-dev-shm-usage`（Docker前提）。

## 8. リスク・未決事項

| # | リスク / 未決 | 影響 | 対応 |
|---|---|---|---|
| 1 | `LlmClient` にJSONモードがなく、scene.json の構造化出力が不安定 | scene ステージが動かない | **Issue #19 をP0の前提として先に片付ける**（429リトライ・thinkingモデル応答・JSON抽出） |
| 2 | **Content IDクレームの確認がAPIで不可能と確定**（§5.8） | 上位設計 §6.4 の公開前ゲートが自動化できない | **人間レビューに落とす**（`review.md` の手動項目）。パイプラインでは検知不能と受け入れる |
| 3 | **OAuth同意画面が「テストモード」だと refresh token が7日で失効** | パイプラインが週次で沈黙し、原因も分かりにくい | **同意画面を「本番公開」に切り替える**。`youtube.upload` は機微スコープだが**利用者が自分だけなら審査不要**（公式に例外明記）。未確認アプリ警告は初回手動通過。⚠️ 「本番公開で7日失効が消える」ことの**公式明記は取れていない**（コミュニティ報告は一致）。**実装後に7日以上おいてトークン生存を実地確認すること** |
| 4 | チャンネル未開設 | upload が検証できない | §4.4 の `--dry-run`。フェーズPのチャンネル開設と並行 |
| 5 | 上位設計 §7 のフェーズ定義が TODO.md と食い違う（§0） | ドキュメント間の齟齬 | 別Issueで上位設計を改訂 |
| 6 | ラウドネス目標 -20〜-16 LUFS は幅が広い | 動画ごとに音量がばらつく | P0は範囲判定のみ。ターゲット値の確定はフェーズ1（🗣 品質バーの壁打ち時） |
| 7 | 声なし方針転換で **Issue #3（TTS選定）が不要**になっている。ラベル `音声`(TTS) も同様。フェーズラベルの定義もTODO.md再編前のまま | 台帳のノイズ | #3 をクローズ提案。#7 は本スペックのIssue群に分解。ラベル整理も別Issue |

**解決済み**（裏取りで消えたリスク。記録として残す）:
- ~~AI開示フィールドのAPI仕様が未確認~~ → **`status.containsSyntheticMedia` で設定可能**（§5.8）
- ~~research の discover と upload がクォータを食い合う~~ → **2026-06-01の専用バケット化で食い合わない**（§4.5）

## 9. Issue分割案

| 新Issue | 内容 | 依存 |
|---|---|---|
| P0-0 | **前提**: LLMクライアント堅牢化（JSONモード・429リトライ・thinking応答） | = 既存 **#19** |
| P0-1 | パイプライン骨格の組み替え（StageId再構成・朗読ステージ削除・license追記モデル修正・core追加） | — |
| P0-2 | `scene` ステージ（LLM → scene.json + uniqueness.json） | P0-0, P0-1 |
| P0-3 | `packages/audio-synth` MVP（雨1プリセット・seed駆動 → ambient.wav） | P0-1, §7確定 |
| P0-4 | `packages/visual-synth` MVP（three.jsヘッドレス1シーン・完全ループ → visual.mp4） | P0-1, §7確定 |
| P0-5 | `video` ステージ（ffmpeg合成・loudnorm 2パス） | P0-3, P0-4 |
| P0-6 | `metadata` ステージ（LLM → metadata.json） | P0-0, P0-2 |
| P0-7 | `checks` ステージ（効能リンター・uniqueness重複・ラウドネス検査） | P0-5, P0-6 |
| P0-8 | `upload` ステージ（OAuth2・限定公開・Content ID確認・`--dry-run`） | P0-7 |
| P0-9 | `review` サマリ出力 ＋ E2E通し（3〜5回） | P0-8 |
| 別 | 上位設計 §7 の改訂（フェーズ定義をTODO.mdに合わせる） | — |
| 別 | #3（TTS選定）クローズ / #7 を P0-3〜5 に分解 | — |

並行可能: P0-3 と P0-4 は独立。P0-2 と P0-3/P0-4 も（scene.json スキーマを先に固定すれば）独立。
