# 調査全文 — YouTube AI生成/改変コンテンツ開示義務

- 確認日: 2026-07-16（全ソース当日にWebFetch/curlで確認。ヘルプページは生HTMLを直接取得し原文照合済み。Wayback Machineで2024年版・2025年版・2026年版の変遷も照合済み）
- 種別: Web調査エージェントのレポート全文（原文ママ）
- 索引: [統合リファレンス](2026-07-16-youtubeポリシー・生成aiライセンス・ニッチ市場調査.md)

## 0. 最重要サマリー（結論先出し）

1. **ポリシーは2026年5〜6月に大改訂された。** ヘルプページは「Disclosing use of altered or synthetic content」から **「Disclosing use of GenAI content（生成 AI コンテンツの使用に関する開示）」に改題**され（Waybackで2026-05-04時点は旧版、2026-06-12時点で新版を確認）、**自動検出によるラベル強制付与**が導入された。
2. **AI生成音楽は2024年の導入当初から一貫して「開示必須」の公式例に明記されている**（現行版でも例示リストの筆頭）。yanchaのAI生成BGMは公式例示上、開示対象。
3. **明らかに非現実的（アニメ調・幻想的）な映像は開示不要**が公式規定。ただしフォトリアルなAI風景映像はグレー〜開示必須寄り。
4. **開示ラベル自体は収益化・推薦に影響しない**とYouTubeは2024年から2026年5月まで一貫して公式に明言。ただし2025年7月の「inauthentic content」収益化ポリシーと2026年1月の大量摘発は**別系統のリスク**として実在する。

---

## 1. 公式ヘルプページの現行規定（原文引用）

**出典:** https://support.google.com/youtube/answer/14328491?hl=en （英語版・生HTML取得、確認日 2026-07-16）
**日本語版:** https://support.google.com/youtube/answer/14328491?hl=ja （同日取得）

### 開示が必須になる条件（公式・原文）

英語原文:
> "To help keep viewers informed about the content they're viewing, we require creators to disclose when they use AI to meaningfully alter or generate photorealistic content. Creators must disclose GenAI content that:
> - Makes a real person appear to say or do something they didn't do.
> - Alters footage of a real event or place.
> - Generates a realistic scene that didn't actually occur.
> This could include content that is fully or partially altered or created using AI tools."

日本語版原文:
> 「クリエイターは、以下の生成 AI コンテンツを開示する必要があります。
> - 実在の人物が実際には発言または行動していないことを、発言または行動しているように見せている。
> - 実際の出来事や場所の映像を改変している。
> - 実際には起きていない場面が現実のように見えるコンテンツを生成している。」

判断原則（原文）:
> "Realistic AI content and meaningful changes require disclosure, while non-realistic or minor edits don't."
> （日本語版:「リアルな AI コンテンツや大幅な変更を加えた場合は開示が必要ですが、非現実的なものや軽微な編集であればその必要はありません。」）

補足: 2024年3月の公式ブログ（https://blog.youtube/news-and-events/disclosing-ai-generated-content/ 2024-03-18付、確認日 2026-07-16）では「リアルなコンテンツ」を "realistic content – content a viewer could easily mistake for a real person, place, scene, or event"（視聴者が実在の人物・場所・場面・出来事と容易に見間違え得るコンテンツ）と定義。この「could easily mistake」の文言は**現行ヘルプページには存在せず**、ブログ側の定義。

### 開示が「必須」の公式例リスト（現行版・全文）

> "Examples of content, edits, or video assistance that creators need to disclose:
> - **AI generated music**
> - AI generated extra footage of a real place, like a video of a surfer in Maui for a promotional travel video
> - AI generated realistic videos of a match between two real professional tennis players
> - Making it appear as if someone gave advice that they did not actually give
> - Showing a realistic depiction of a tornado or other weather events moving toward a real city that didn't actually happen
> - Making it appear as if hospital workers turned away sick or wounded patients
> - Depicting a public figure stealing something they did not steal, or admitting to stealing something when they did not make that admission
> - Making it look like a real person has been arrested or imprisoned
> Keep in mind, the above list is not exhaustive."

日本語版対応箇所:「クリエイターによる開示が必要なコンテンツ、編集、動画制作支援の例: **AI 生成の音楽**、AI で生成された、実在する場所の追加映像（プロモーション用旅行動画に、マウイ島のサーファーの AI 生成動画を追加するなど）…（以下同）」

### 開示が「不要」の公式例リスト（現行版・全文）

> "Creators don't need to disclose non-realistic content that's made with AI, or edits to realistic content that are minor. Minor edits are ones that are primarily aesthetic, and don't alter the content in a way that could mislead the viewer about what actually happened.
>
> **Not realistic**
> - Someone riding a unicorn through a fantastical world
> - Green screen used to depict someone floating in space
> - Using an AI-generated or altered animation of a missile in a fully animated video
>
> **Minor**
> - Applying beauty filters
> - Color adjustment or lighting filters
> - Special effects filters, like adding background blur or vintage effects
> - Production assistance, like using generative AI tools to create or improve a video outline, script, thumbnail, title, or infographic
> - Caption creation
> - Video sharpening, upscaling or repair and voice or audio repair
> - Idea generation
> - **Cloning one's own voice to create voice overs or dubs**
> - Gameplay footage from video games
> - AI generating or extending a backdrop to simulate a moving car
> - Using effects to enhance previously recorded audio"

日本語版:「非現実的な内容: ユニコーンに乗って幻想的な世界を旅する人物／グリーン スクリーンを使って生成した、宇宙を漂う人の映像／AI で生成または改変したミサイルのアニメーションが使われているフル アニメーション動画」「軽微な編集: …クローニングした自分の声でナレーションや吹き替えを制作…」

注: 公式に「clearly unrealistic」という語を使うのは2024年3月ブログ（"we're not requiring creators to disclose content that is clearly unrealistic, animated, includes special effects, or has used generative AI for production assistance"）。ヘルプページの見出しは「Not realistic／非現実的な内容」。

---

## 2. ヒーリング映像（抽象・アニメ調・CG調）の開示要否【公式基準への当てはめ＝解釈】

**公式基準:** 開示不要となるのは「non-realistic content」（幻想世界・フルアニメーション等）。開示必須となるのは「realistic scene that didn't actually occur」「footage of a real event or place の改変」「実在する場所のAI生成追加映像」。

**解釈（推測を含む・公式判定ではない）:**
- **抽象映像・パーティクル・明らかにCG的なファンタジー風景・アニメ調** → 「Not realistic」例（ユニコーン・幻想世界・フルアニメ）に直接対応し、**開示不要**と読める。
- **フォトリアルなAI自然風景（実在しない浜辺・森・雨の夜景など）** → 実在の場所を騙っていなくても「Generates a realistic scene that didn't actually occur（実際には起きていない場面が現実のように見える）」の文言に形式上は該当し得るため、**開示必須寄りのグレー**。特にマウイ島の例のように「実在の場所風」の映像は明確に必須。
- **実務上の重要点:** 2026年5月以降は下記の自動検出があるため、フォトリアル寄りの映像は**自主開示しておくのが安全**（開示自体にペナルティはない、後述）。なお非フォトリアル/アニメ調コンテンツを開示した場合のラベルは説明欄内のみで目立たない。

---

## 3. AI生成音楽（BGM）・合成音声の扱い

**公式事実:**
- **現行版:** 開示必須例の筆頭に「**AI generated music**」「**AI 生成の音楽**」と明記（上記引用のとおり）。
- **2024年3月18日の初版**（Wayback: http://web.archive.org/web/20240318155046/https://support.google.com/youtube/answer/14328491 確認日 2026-07-16）でも既に:
  > "Synthetically generating music (**including music generated using Creator Music**)"
  > "Voice cloning someone else's voice to use it for voiceover"（他人の声のクローンは必須）
  > "Digitally altering audio to make it sound as if a popular singer missed a note in their live performance"（実在歌手の音声改変は必須）
- 2025年6月版（Wayback 2025-06-02）では「Synthetically generating music」（Creator Musicの括弧書き削除）＋開示不要側に「Cloning one's own voice to create voiceovers or dubs（自分自身の声のクローン）」「Gameplay footage」が追加。
- 開示不要側には音声関連として「voice or audio repair（音声の修復）」「Using effects to enhance previously recorded audio（録音済み音声のエフェクト補正）」「自分の声のクローンによるナレーション」のみ。

**結論（公式例示ベース）:** 「実在の人物の声の模倣」に限らず、**AI生成音楽そのものが開示必須例として明記されている**。これは「リアリズム基準」の一般原則からはやや浮いた規定だが、初版から一貫して存在する。**yanchaのAI生成BGMを使う動画は、公式例示に従えば開示対象**（解釈の余地: 「音楽が主体でない動画のBGM」への適用度合いは公式に明示されておらず、ここは不明確。ただし文言上は区別がない）。なおSuno等の規約とは別問題で、これはあくまでYouTube側の視聴者向け開示。

---

## 4. ラベルの表示のされ方（変遷あり・重要）

**2024年3月版（Wayback原文）:**
> "we'll add a label to their video's description field."（説明欄の「Altered or synthetic content」ラベル）
> "For content about sensitive topics like these [elections, ongoing conflicts, natural disasters, finance, or health], a more prominent label in the video player may also appear for added transparency."（センシティブトピック＝選挙・紛争・災害・金融・**健康**では、プレーヤー上に目立つラベル）

**現行版（2026年6月〜、原文）:**
> "For AI content that is photorealistic, a label in the video player may also appear."
> "Labels may appear in the expanded description for AI content that is non-photorealistic or animated."
> 日本語版:「写真のようにリアルな AI コンテンツの場合は、動画プレーヤーにラベルが表示されることもあります」「写真のようにリアルではない AI コンテンツやアニメーションの AI コンテンツについては、展開された説明欄にラベルが表示されることがあります」

**変更点:** センシティブトピック基準のプレーヤー上ラベル条項は現行ページから削除され、「**フォトリアルか否か**」でプレーヤー上/説明欄が分かれる基準に置き換わった。2026年5月27日の公式ブログ（https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/ 確認日 2026-07-16）によれば、長尺動画では「ラベルはプレーヤー直下・説明欄の上に表示」、**Shortsでは動画上のオーバーレイ表示**（TechCrunch 2026-05-27: https://techcrunch.com/2026/05/27/youtube-will-now-automatically-label-ai-videos/ も同旨）。

**解釈:** アニメ調・非フォトリアルのヒーリング映像なら、開示しても表示は説明欄内ラベルにとどまる可能性が高く、視聴体験への影響は小さい。

---

## 5. 収益化・リーチへの影響

### 公式声明（一貫している）
- 現行ヘルプ原文: > "**Disclosing AI content won't limit a video's audience or impact its eligibility to earn money.**"
  日本語版:「AI コンテンツについて開示を行っても、動画の視聴者に制限が設けられることはなく、収益化の資格にも影響はありません。」（2024年初版から同旨の文言あり: "Disclosing content as altered or synthetic won't limit a video's audience or impact its eligibility to earn money."）
- 2026年5月27日公式ブログ: > "**a disclosure label alone does not change how a video is recommended or whether it's eligible to earn money.**"

### 実測データ・クリエイター報告
- ラベル単体の影響を統制した公開実測データは**見つからなかった**（確認日 2026-07-16 時点）。
- 一方、クリエイター報告レベルでは、AI/顔出しなしチャンネルの抑制・収益化剥奪の訴えが多数。The Next Web（https://thenextweb.com/news/youtube-ai-slop-crackdown-faceless-creators-collateral-damage 確認日 2026-07-16）は、**アンビエント動画を含む顔出しなしクリエイターが2026年の取り締まりの巻き添えになっている**と報道。登録者170万人のクリエイター Doctor NOS の発言として "the people who do the same content as me without their face in it, most of them are getting demonetised"（顔を出さない同種コンテンツの人の大半が収益化剥奪されている）を引用。
- **区別が重要（解釈）:** これらの報告は「開示ラベル」の効果ではなく、後述の **inauthentic content ポリシー（量産型コンテンツの収益化不適格）** による可能性が高い。公式は「ラベル alone は影響しない」としか言っておらず、AIコンテンツ全般の推薦・収益化はラベルと別のレイヤーで絞られている、というのが実態に近い（推測）。

---

## 6. 2025〜2026年の規定強化・変更（時系列）

| 時期 | 変更 | 出典 |
|---|---|---|
| 2024-03-18 | 開示義務導入。「Altered content」設定、説明欄ラベル＋センシティブトピックのプレーヤーラベル | blog.youtube、Wayback初版 |
| 2024-10 | **C2PAベース「Captured with a camera」開示**を導入（C2PA 2.1以上のメタデータを持つ無編集実写に「How this content was made」欄で表示） | https://support.google.com/youtube/answer/15446725 、https://support.google.com/youtube/answer/15447836 、PetaPixel 2024-10-16 |
| 2025-07-15 | YPP収益化ポリシーの「repetitious content」を「**inauthentic content（本物ではないコンテンツ）**」に改称・明確化。量産型・テンプレAIコンテンツは収益化不適格（開示義務とは別制度）。YouTubeは「AI使用自体は収益化可能」と明言 | TechCrunch 2025-07-09、Social Media Today、support.google.com/youtube/answer/1311392 |
| 2026-01 | CEO Neal Mohanが年頭書簡で「AI slop」対策を最優先と宣言。直後に**16チャンネル（計3,500万登録、47億回再生、推定年収$9.8M）を停止/コンテンツ削除**。根拠は「スパム・欺瞞行為ポリシー」であり開示義務違反ではない | TechTimes 2026-07-15、The Next Web |
| 2026-05-27 | **自動検出・自動ラベル付与を導入**。ラベル表示位置を強化（プレーヤー直下/Shortsオーバーレイ） | blog.youtube「Improving AI labels」、TechCrunch、MacRumors、Variety |
| 2026-05〜06 | ヘルプページを「Disclosing use of GenAI content」に全面改訂（Wayback比較で2026-05-04→06-12の間と特定）。「AI use」設定に改称、自動検出条項・C2PA条項を追加、センシティブトピック条項を削除 | Waybackスナップショット比較（当調査で実施） |

### 自動検出の現行規定（原文）
> "YouTube may automatically apply an AI label on the video player or in the expanded description for:
> - Content made using YouTube's GenAI tools
> - Content that contains **C2PA metadata**
> - Content that our internal systems detect is AI generated or altered"
>
> "If our systems make an error, creators will have the ability to change AI disclosure in most cases by selecting No in the AI disclosure survey... However, **content made with YouTube's AI tools, content containing C2PA metadata, or content labeled after manual review can not be adjusted.**"

つまり Sora/Veo 等C2PAメタデータを埋め込むツールの出力は、**アップロードした時点で自動ラベル付与され、クリエイター側で解除不可**。公式ブログ原文: "If a creator doesn't specify whether or not they used AI, but our systems detect significant photorealistic AI use, we will now automatically apply a label."

---

## 7. 未開示の場合のペナルティ

### 公式規定（現行版原文）
> "**Creators who consistently choose not to disclose this information may be subject to manual application of a label, or penalties from YouTube, including removal of content or suspension from the YouTube Partner Program.**"
> 日本語版:「クリエイターがこの情報開示を繰り返し意図的に怠る場合は、YouTube によるラベルの手動適用やペナルティ（コンテンツの削除や YouTube パートナー プログラムへの参加停止など）が発生する可能性があります。」

2024年初版はこれに加えて "in some cases YouTube may take action to reduce the risk of harm to viewers by proactively applying a label that creators will not have the option to remove"（削除不可ラベルの強制付与）と記載。

### 実際の執行事例
- **「開示義務違反のみ」を理由とした公表済みの処分事例は、信頼できる報道からは確認できなかった**（確認日 2026-07-16）。
- 2026年1月の大量停止（16チャンネル）は**スパム・欺瞞行為/inauthentic contentポリシー違反**が根拠で、開示義務の執行事例ではない（YouTube広報がTechTimes等に確認）。
- 一部SEO系ブログ（ytzolo.com、shortsfast.com等）に「2026年1月に開示違反で数千チャンネル停止」という記述があるが、**一次ソース・大手報道の裏付けがなく信頼性は低い**（当調査の評価）。
- 実質的な執行は「罰則」より**自動検出による強制ラベル付与**（2026年5月〜）へシフトしたと見られる（解釈）。

---

## 8. yanchaプロジェクトへの示唆（解釈・推測）

1. **AI生成BGM → 開示対象**（公式例示「AI generated music」）。開示しても収益化・リーチに公式には影響なし。非フォトリアル動画ならラベルは説明欄内のみ。開示コストは実質ゼロなので「はい」を選ぶのが安全。
2. **抽象・アニメ調・明らかにCGのヒーリング映像 → 開示不要**（「Not realistic」該当）。ただしBGMがAI生成なら結局動画として開示要件を満たすため、実務上は常に開示で統一するのが簡明。
3. **フォトリアルAI風景は要注意**。実在地名を付けると「実在する場所の追加映像」で明確に必須。2026年5月以降は未開示でも自動検出でラベルが付き、常習的未開示はYPP停止リスクの公式文言に該当。
4. **本当のリスクは開示ラベルではなくinauthentic content（量産型）ポリシー**。2026年のYouTubeは顔出しなし・テンプレ量産型のAI睡眠/アンビエント系を重点的に絞っており（The Next Web報道）、CLAUDE.mdの「飽和×量で戦わない」「変換的・独自」方針はこのリスクに正しく整合している。人間の創作的関与・独自性の証跡（制作過程、オリジナルアセット、ライセンス証跡）を残すことが防御になる。

## 確認済み独立ソース一覧（全て2026-07-16確認）
1. https://support.google.com/youtube/answer/14328491?hl=en （現行・生HTML）
2. https://support.google.com/youtube/answer/14328491?hl=ja （現行・生HTML）
3. Wayback 2024-03-18 / 2025-06-02 / 2026-04-11 / 2026-06-12 各スナップショット（web.archive.org）
4. https://blog.youtube/news-and-events/disclosing-ai-generated-content/ （2024-03-18）
5. https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/ （2026-05-27）
6. https://techcrunch.com/2026/05/27/youtube-will-now-automatically-label-ai-videos/
7. https://support.google.com/youtube/answer/15446725 ＋ /15447836 （C2PA「Captured with a camera」）
8. https://petapixel.com/2024/10/16/youtubes-new-content-credentials-point-toward-a-more-transparent-future-for-video-content/
9. https://techcrunch.com/2025/07/09/youtube-prepares-crackdown-on-mass-produced-and-repetitive-videos-as-concern-over-ai-slop-grows/ ＋ https://www.socialmediatoday.com/news/youtube-clarifies-monetization-update-inauthentic-repeated-content/752892/
10. https://www.techtimes.com/articles/320629/20260715/youtube-wiped-35m-subscribers-over-ai-slop-now-its-judging-your-taste.htm
11. https://thenextweb.com/news/youtube-ai-slop-crackdown-faceless-creators-collateral-damage
12. https://www.macrumors.com/2026/05/27/youtube-automatic-ai-video-labeling/ ／ Variety（2026年5月自動ラベル報道）

（注: ytzolo.com等のSEOブログは参照したが信頼性が低いため事実認定には使用していない。ヘルプページの引用はWebFetch要約ではなくcurlで取得した生HTMLからの原文抽出であり、引用精度は高い。）
