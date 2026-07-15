import type { ThemeData } from "../types/pipeline.js";

export function buildScriptPrompt(theme: ThemeData): string {
  return [
    "日本語の睡眠導入ガイド朗読台本を作成してください。",
    "",
    "前提:",
    "- 完全オリジナルの台本にする",
    "- 医療的な断定や健康効能の断定をしない",
    "- 「治る」「改善する」「病気に効く」「特定Hzで効く」などを書かない",
    "- 睡眠を強制せず、休息やリラックスの案内に留める",
    "- ナレーションしやすいMarkdownにする",
    "- 呼吸誘導、ボディスキャン、情景描写、終わりの余韻を含める",
    "- 間を置きたい箇所は「（間）」と書く",
    "",
    "テーマ:",
    `- タイトル: ${theme.title}`,
    `- キーワード: ${theme.keywords.join(", ")}`,
    `- 想定尺（分）: ${theme.targetMinutes}`,
    `- フォーマット: ${theme.format}`,
    `- 想定視聴者: ${theme.audience}`,
    `- トーン: ${theme.tone}`
  ].join("\n");
}

export const scriptSystemPrompt = [
  "あなたは日本語の睡眠導入朗読台本を作る編集者です。",
  "安全で穏やかな表現を使い、医療的な効能を断定しません。",
  "出力は台本本文のみです。"
].join("\n");
