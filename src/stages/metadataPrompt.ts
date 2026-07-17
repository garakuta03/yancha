import type { SceneData } from "../types/pipeline.js";

export function buildMetadataPrompt(scene: SceneData): string {
  return [
    "scene.jsonをもとに、YouTube投稿用のmetadata.jsonをJSONオブジェクトだけで作成してください。",
    "健康効能の断定、不眠や病気が治る表現、医療的な効果、特定周波数での改善効果の表現は禁止です。",
    "説明文は毎回同じ構造・連番テンプレート・定型句の羅列にしないでください。作品ごとの情景と言葉の順序を変え、量産感を避けてください。",
    "サムネ画像は生成しません。thumbnailPromptにはサムネ案のテキストだけを書いてください。",
    `descriptionには次のstorylineを自然な形で必ず含めてください: ${scene.storyline}`,
    "",
    "必須スキーマ:",
    "{",
    '  "title": "動画タイトル。効能断定は禁止。",',
    '  "description": "説明文。storylineを含める。効能断定は禁止。",',
    '  "tags": ["タグ1", "タグ2", "タグ3"],',
    '  "thumbnailPrompt": "サムネ案テキスト1つ"',
    "}",
    "",
    "制約:",
    "- title / description / thumbnailPrompt は空でない文字列。",
    "- tags は1件以上15件以下。各タグは空でない文字列。",
    "- titleは睡眠導入やリラックスを断定効能として書かず、視聴シーンの提案に留める。",
    "- descriptionはstorylineを含めたうえで、動画の情景・音・映像を説明する。",
    "- 「第1弾」「第2弾」「毎日投稿」「完全版」など、連番や量産テンプレートに見える語は避ける。",
    "",
    `- sceneId: ${scene.sceneId}`,
    `- scene title: ${scene.title}`,
    `- storyline: ${scene.storyline}`,
    `- durationSeconds: ${scene.durationSeconds}`,
    `- audio preset: ${scene.audio.preset}`,
    `- visual preset: ${scene.visual.preset}`
  ].join("\n");
}
