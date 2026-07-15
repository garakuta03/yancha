# Gemini API ライセンス・料金・YouTube規約 調査メモ

- 調査日: 2026-07-16
- 目的: TTS/画像/音楽の各ステージをGemini APIに寄せる際の、料金・著作権・収益化ライセンス・YouTube規約の確認
- ⚠️ プレビューモデルの料金/無料枠は頻繁に変わる。**本番前に必ず公式ページと自分のAI Studioで再確認**すること。
- 関連: [設計ドキュメント](../design/2026-07-16-ai睡眠動画チャンネル設計.md) の「ホワイト運用 × 完全オリジナル・自社ライセンス」原則

---

## 0. 結論・運用方針

- **検証フェーズは無料枠でOK**（TTS/画像）。ただし**音楽Lyriaは無料枠なし**。
- **本番（収益化）は有料API tierで生成する。** 理由：
  1. 有料APIは**送信内容が学習に使われない**（無料枠は学習利用される）
  2. 可視ロゴ（Nano Banana等）が付かない
  3. レート制限が安定
  4. 証跡（`license.json`）が明確
- **コストは激安**：1本あたり TTS(十数分)＋画像数枚＋音楽1曲 ≒ **約$0.5（約75円）**。
  睡眠動画は長尺でもナレーションは冒頭中心・音楽はループなので低コストを維持できる。

## 1. 料金・無料枠（2026-07時点）

| 用途 | モデル例 | 無料枠 | 有料の目安 |
|---|---|---|---|
| TTS | gemini-3.1-flash-tts-preview | ✅ プレビュー中は無料（※データ学習利用あり） | 音声出力 約$10/1Mトークン（25トークン/秒 ≒ 11時間/1M） |
| TTS(Pro) | pro-tts | ❌ 有料のみ | 約$20/1Mトークン |
| 画像 | gemini-2.5-flash-image / 3.1-flash-image | ✅ 無料枠あり（レート制限＋学習利用） | 約$0.04〜0.067/枚 |
| 音楽 | **lyria-3** | ❌ **無料枠なし・有料のみ** | $0.04（30秒クリップ）/ $0.08（フル1曲） |
| テキスト(台本) | gemini-3.5-flash | 新規キーで疎通確認済み（2.5-flashは新規キー404） | ごく僅少（1本コンマ数円未満） |

- 無料枠は「unpaid services」扱い＝**送信内容がモデル改善（学習）に使われる**。有料APIなら学習に使われない。

## 2. 著作権・商用/収益化ライセンス

- **Googleは生成物の所有権を主張しない → 商用利用・収益化は契約上OK**（Acceptable Use Policy順守が前提）。画像・音声・Lyria音源とも同方向。
- ⚠️ 「所有権を主張しない」≠「あなたに著作権がある」。**純AI生成物は米国等で著作権が発生しない可能性**（Thaler v. Perlmutter）。
  → 商用利用はできるが、**他人がコピーしても差し止められない**。＝「量産の数」自体は堀にならない。だから独自構成・世界観で差別化する方針が正しい。
- **SynthID（不可視透かし）**が埋め込まれる。**除去はTOS違反・透明性法抵触のリスク**があるので触らない。
- 可視の「Nano Banana」ロゴがDL時に付く場合がある → 収益化するなら**API経由（ロゴなし）**が無難。
- **第三者IPリスク**：ブランド名・実在キャラ・作家名をプロンプトに入れない（本プロジェクトの原則と一致）。

## 3. YouTube規約

- **AI生成コンテンツ自体は許可・収益化可能。** ただし要注意が2点：
  1. **合成コンテンツの開示**：リアルな人物/出来事を模す・視聴者が誤認しうる「改変・合成」は開示必須。
     - AI音声ナレーション＋リアルな実写風映像は**開示対象になり得る**。抽象/ファンタジー映像なら対象外のことが多い。
     - 該当時はYouTubeのAI開示設定をON（CLAUDE.mdに既記載）。
  2. **再利用・繰り返し/大量生産の不正（収益化の本丸）**：薄いAI量産はNG。
     - → オリジナル台本＋独自構成で回避（既定路線）。
- **Content ID衝突**：Lyria等で生成した**オリジナル音源**なら第三者衝突は理論上なし。証跡を`license.json`に残す運用が有効。

## 4. 出典（本番前に再確認すること）

- Gemini API pricing（公式）: https://ai.google.dev/gemini-api/docs/pricing
- Gemini 3.1 Flash TTS Pricing (2026): https://www.nemovideo.com/blog/gemini-3-1-flash-tts-pricing
- Gemini Output Ownership & Commercial Rights 2026 (Terms.Law): https://terms.law/ai-output-rights/gemini/
- Gemini Generated Images Commercial Use 2026: https://banana-clean.app/blog/gemini-images-copyright-commercial-use
- Gemini API Image Generation / SynthID (zenn): https://zenn.dev/sora_biz/articles/gemini-api-image-generation-guide?locale=en
- Google Terms of Service: https://policies.google.com/terms
