# GCP / YouTube Data API v3 の設定

- 日付: 2026-07-16
- 対象: GCPプロジェクト（`hakoniwa.scene@gmail.com` 配下）
- 関連: [TODO.md](../../TODO.md) フェーズP / Issue #8 / **Issue #27（upload ステージ）** /
  [P0 E2E MVP 設計](../superpowers/specs/2026-07-16-p0-e2e-mvp-design.md) §4.5
- 前提: チャンネル（ブランドアカウント）作成済み → [チャンネル開設の実地メモ](2026-07-16-youtubeチャンネル開設の実地メモ.md)

> **APIキーとOAuthクライアントは用途が違う。混同しないこと。**
>
> | | 用途 | いつ要る |
> |---|---|---|
> | **APIキー** | 公開データの読み取り（`search.list` / `channels.list`）。**research の観測**が使う | **今すぐ**（観測開始＝2〜4週間の最長の待ちを握っている） |
> | **OAuthクライアント** | 動画アップロード（`videos.insert`）。スコープは `youtube.upload` のみ | #27 の実装時 |

---

## 0. 🔴 想定が外れた点（先に潰す）

### ① `search.list` のクォータ前提が変わっていた ← **既存コードに影響**

現在の公式原文（[Overview](https://developers.google.com/youtube/v3/getting-started) / 最終更新 2026-06-01）:

> Projects that enable the YouTube Data API have a default quota allocation of
> **100 search.list calls, 100 videos.insert calls, and 10,000 units per day combined for all other endpoints.**

**3つの独立したバケットになっている:**

| 対象 | 枠 |
|---|---|
| `search.list` | **100回/日（専用枠）** ← ⚠️ 認識と違った |
| `videos.insert` | 100回/日（専用枠） |
| その他すべて（`channels.list` / `videos.list` 等） | 10,000ユニット/日の合算 |

⚠️ **旧情報「search.list は1回100ユニット → 10,000枠を消費」は失効している。**
現在の `search.list` は**10,000枠を消費しない**。使い切っても `videos.list` / `channels.list` の枠は無傷。

→ **`packages/research` のクォータ見積り・ガード（`quotaGuardUnits`）は前提が変わっている。**
設計docの「1回の discover 見積り: キーワード数 × 100 ＋ ceil(件数/50)」という
**ユニット計算が成立しない**（search.list はユニットを消費しない別枠）。
**別Issueで見直すこと。**

### ② OAuth時に「チャンネルを選択させられる」は公式に裏付けがない ← **むしろ逆**

当初「同意画面でどのチャンネルに権限を与えるか選ばされる」と想定していたが、
**公式ドキュメントにその記述は存在しない。** それどころか公式は逆の警告をしている
（[Issues using third-party tools with Brand Accounts](https://support.google.com/youtube/answer/3046478?hl=en)）:

> Unfortunately, **some third-party and older apps don't support channel switching.
> They might give you an error or sign you in to the wrong channel.**

問題が起きるアプリとして公式が名指ししているもの:
> **Other applications that use API authentication**

→ **API認証を使うアプリは、公式が「間違ったチャンネルにサインインし得る」と名指しで警告している側。**
選択画面が出る保証はない。

**対策（§4 に詳述）: トークン取得後に `channels.list?mine=true` で必ず検証する。**
公式は「デフォルトチャンネルを設定せよ」とも述べているが、**その手順ページのURLは特定できなかった**。

---

## 1. パートA: APIキー（今すぐ）

- [ ] **1.** ブラウザで **`hakoniwa.scene@gmail.com` のみ**にログイン
      （複数ログインは誤プロジェクト作成の温床。403の件と同根）
- [ ] **2.** https://console.cloud.google.com/projectcreate
- [ ] **3.** プロジェクト名（例: `yancha-youtube`）→ **作成**。組織なし・課金紐付けなしのまま
- [ ] **4.** 画面上部で**新プロジェクトが選択されているか確認**（最頻出ミス）
- [ ] **5.** https://console.cloud.google.com/apis/library/youtube.googleapis.com → **有効にする**
      - 🔴 **この順番を飛ばさないこと。** 手順8の「APIの制限」ドロップダウンには
        **そのプロジェクトで有効化済みのAPIしか出てこない**。
        先にキーを作ろうとすると「**表示する項目はありません**」となり、
        API制限が必須なのに設定できず詰まる（実際にハマった）
      - ⚠️ **課金を求められたら止めて報告すること**（§5 参照。公式に課金必須の記述はない＝想定外）
- [ ] **6.** https://console.cloud.google.com/apis/credentials → **認証情報を作成 → APIキー**
- [ ] **7.** キーをコピー
- [ ] **8.** **キーを制限**:
      - **APIの制限** → **YouTube Data API v3 のみ**（公式: コンソールは最低1つのAPI制限を要求する）
        - 「表示する項目はありません」と出たら → **手順5をやっていない**（または反映待ち）
      - **アプリケーションの制限** → **なし**
        ⚠️ **これは公式推奨からの意図的な逸脱。** 選択肢が Websites / IP / Android / iOS しかなく、
        ローカル実行のTSスクリプトに合わない。IP制限は自宅IPが動的だと回線再接続で壊れる
- [ ] **9.** **`.env`** に `YOUTUBE_API_KEY` を格納（このプロジェクトの流儀。`.env.example` 参照。`.gitignore` 済み）
      - ⚠️ `.env` は**自動では読み込まれない**。`package.json` の各スクリプトに
        `tsx --env-file-if-exists=.env` を付けてある（Node 20.18+ が必要）
- [ ] **10.** 疎通確認:
      `channels.list?part=snippet&id=UC5rnnlWXI8713Ue-y_iMy1A&key=<APIキー>` で 200
- [ ] **11.** ⚠️ **research のレート制御を見直す**（§0-①）

## 2. パートB: OAuthクライアント（#27 の実装時）

⚠️ **「OAuth同意画面」は「Google Auth Platform」に再編済み**（想定どおり）。
セクション構成: Branding / Audience / Clients / Data Access / Verification Center。

- [ ] **1.** サイドメニュー → **Google Auth Platform** → **GET STARTED**
- [ ] **2.** App name（例: `yancha-uploader`）/ User support email
- [ ] **3.** **Audience** → **External**
      （個人Gmailは Organization を持たないため **Internal は選択肢に出ない**）
- [ ] **4.** **Data Access** → スコープに **`https://www.googleapis.com/auth/youtube.upload` のみ**
      - 📌 **ここで "Sensitive" バッジが付くか確認する。** `youtube.upload` の分類は
        公式原文で確定できなかった（§5）。実機が最も確実
- [ ] **5.** 🔴 **Audience → Publish app → In production にする**（§3 が理由）
- [ ] **6.** **Clients** → **Create client** → **Application type: Desktop app**
      - **リダイレクトURI欄は出ないはず**（公式: "The console does not require any additional
        information to create OAuth 2.0 credentials for desktop applications."）
      - 🔶 ⚠️ **公式2文書が矛盾している**: installed-apps 側には「登録済みURIと一致必須」とある。
        ヘルプセンター側（不要）が正と読めるが要実機確認
- [ ] **7.** client ID / client secret を **`.env`** へ（`.envrc` ではない。§1-9 参照）
- [ ] **8.** ループバック認可（`http://127.0.0.1:<port>`）＋ `access_type=offline`
      - ⚠️ **OOB（`urn:ietf:wg:oauth:2.0:oob`）は廃止済み・使用不可。** 古い記事のコードを写さない
- [ ] **9.** 🔴 **【必須検証】§4 を実行する**

---

## 3. 🔴 なぜ「In production」にしなければならないか

### Testing = refresh token が7日で失効（**公式明記。前回取れなかった原文が取れた**）

[Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)（最終更新 2026-05-26）:

> A Google Cloud Platform project with an OAuth consent screen configured for an external user type
> and a **publishing status of 'Testing'** is issued a refresh token expiring in **7 days**,
> unless the only OAuth scopes requested are a subset of name, email address, and user profile.

[Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en):
> Authorizations by a test user will expire **seven days** from the time of consent.
> If your OAuth client requests an offline access type and receives a refresh token, that token will also expire.

### 🔶 ただし「In production なら失効しない」の明示文は**存在しない**

**「Testing = 7日失効」は公式明記（✅）。「production = 失効しない」は明示文なし、条件記述からの含意（🔶）。**

補強材料: 同ページの「refresh token が失効する理由」の完全なリストに publishing status は含まれていない:
1. ユーザーがアクセスを取り消した
2. **6ヶ月間使われていない**
3. パスワード変更（Gmailスコープを含む場合）
4. 付与された live refresh token の上限超過
5. 時限アクセスの期限切れ
6. 管理者がスコープを Restricted に設定

→ 運用上は In production にすべき。ただし**100%の保証を公式文で示すことはできない**。
**実装から7日以上おいて、再認証なしでアップロードできるか実地確認すること**（#27 Task 8 Step 6）。

### ⚠️ 6ヶ月ルール（新発見）

> The refresh token has **not been used for six months**

**本番公開しても、6ヶ月使わなければ失効する。** 投稿が長期間途切れる場合は要注意。

### ✅ 審査（verification）は不要 — 公式明記

[When is verification not needed](https://support.google.com/cloud/answer/13464323?hl=en):
> **Personal Use:** If the app is for your personal use (fewer than 100 users), you and your limited
> number of users can continue using the app **without going through verification**.

### ⚠️ ただし「本番公開すれば100ユーザー上限が消える」は**誤り**

In production × 未審査 の場合:
- ✅ refresh token の**7日失効は解消される**（条件から外れるため）
- ❌ **未確認アプリの警告画面は出続ける**
- ❌ **累計100ユーザーの上限は残る**（"100 new users in total"）
  — 消えるのは *test user* としての100人枠。未審査アプリの100人上限は**別に存在し続ける**

自分1人しか使わないので実害はゼロだが、認識は正確に。

⚠️ **警告画面の突破手順（"Advanced" → "Go to {app} (unsafe)"）は公式ページに記載を確認できなかった。**
よく知られた挙動だが、公式裏取りなし。

---

## 4. 🔴 【必須】トークンがどのチャンネルに紐づいたかを検証する

§0-② のとおり、**同意画面でチャンネルを選べる保証はなく、公式は「間違ったチャンネルにサインインし得る」と警告している。**
このアカウントには**チャンネルが2つある**（ブランド `@hakoniwa-n2y` / 個人 `@hakoniwa-f7h`）ため、
**取り違えるとパイプラインが個人チャンネルに投稿する。**

### 唯一の確実な確認手段

```
channels.list?part=id,snippet&mine=true
```

公式（[channels.list](https://developers.google.com/youtube/v3/docs/channels/list)）:
> Set this parameter's value to `true` to instruct the API to only return channels
> owned by the authenticated user.

- クォータ **1ユニット**（10,000枠から。安い）
- `items[0].id` が **`UC5rnnlWXI8713Ue-y_iMy1A`** であることを確認
- **一致しなければ、そのトークンは個人チャンネルに紐づいている**

→ **#27 の実装に、この検証を組み込むこと**（`auth` サブコマンドの最後に自動チェック）。

### 間違った場合のやり直し（✅ 可能）

1. https://myaccount.google.com/permissions で該当アプリのアクセスを削除
   （公式: "This revokes any access that you have previously granted them."）
2. ローカルの refresh token を破棄
3. YouTube でデフォルトチャンネルを `@hakoniwa-n2y` に設定
   （⚠️ **手順ページのURLは特定できなかった**。YouTubeの設定→アカウント配下にあるはず。実機で探す）
4. 認可フローをやり直す

### その他の落とし穴

- **6ヶ月間 token exchange にも設定編集にも使われない OAuth クライアントは Google に削除される可能性がある**
  （削除後30日間は Cloud Console から復元可）
- refresh token は **1 Googleアカウント × 1 client ID あたり最大100個**。取り直しを繰り返すと古いものから無効化される

---

## 5. 公式に確認できなかった項目（推測で埋めないこと）

| 項目 | 状態 |
|---|---|
| **`youtube.upload` の sensitive 分類** | ❌ 公式原文で確定できず（scopesページのYouTubeセクションに到達不可）。**Data Access のバッジで実機確認** |
| **「In production で7日失効が解消」の明示文** | ❌ 明示文なし。「Testing = 7日」の**条件限定記述からの含意**のみ |
| **課金アカウント不要の明言** | ❌ 「必要」の記述も「不要」の明言も**どちらもなし**。「課金要求の記述が存在しない」＋「ユニット≠通貨」からの推論 |
| **GCPコンソールの正確なメニュー階層** | ❌ console.cloud.google.com は認証必須で取得不可。セクション名はヘルプセンター準拠 |
| **未確認アプリ警告の突破手順** | ❌ 公式ページに記載を確認できず |
| **デフォルトチャンネル設定の手順ページ** | ❌ URL特定できず（候補404）。「設定せよ」という公式の推奨のみ確認 |
| **Desktop app のリダイレクトURI登録要否** | 🔶 **公式2文書が矛盾**。ヘルプセンター「不要」vs installed-apps「一致必須」。要実機確認 |

## 参照

- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started) (2026-06-01)
- [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost) (2026-06-01)
- [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2) (2026-05-26)
- [OAuth 2.0 for Native Apps](https://developers.google.com/identity/protocols/oauth2/native-app) (2026-05-26)
- [OAuth 2.0 for Mobile & Desktop Apps (YouTube)](https://developers.google.com/youtube/v3/guides/auth/installed-apps) (2026-05-26)
- [Get started with the Google Auth Platform](https://support.google.com/cloud/answer/15544987?hl=en)
- [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en)
- [Manage OAuth Clients](https://support.google.com/cloud/answer/15549257?hl=en)
- [When is verification not needed](https://support.google.com/cloud/answer/13464323?hl=en)
- [Unverified apps](https://support.google.com/cloud/answer/7454865?hl=en)
- [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Best practices for securely using API keys](https://support.google.com/googleapi/answer/6310037?hl=en)
- [channels.list](https://developers.google.com/youtube/v3/docs/channels/list)
- [Issues using third-party tools with Brand Accounts](https://support.google.com/youtube/answer/3046478?hl=en)
