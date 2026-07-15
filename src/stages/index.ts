import type { LlmClient } from "../clients/llm.js";
import type { StageRunner } from "../types/pipeline.js";
import { PlaceholderStage } from "./placeholders.js";
import { ScriptStage } from "./script.js";
import { ThemeStage } from "./theme.js";

export function createStageRunners(llmClient: LlmClient): readonly StageRunner[] {
  return [
    new ThemeStage(),
    new ScriptStage(llmClient),
    new PlaceholderStage("narration", "narration.meta.json", "ナレーション音声生成はTTSの商用ライセンス確認後に接続します。", ["script.md"], ["narration.wav"]),
    new PlaceholderStage("music", "music.meta.json", "音楽・環境音生成は商用利用可能な生成元を確定してから接続します。", ["theme.json"], ["bgm.wav", "ambient.wav"]),
    new PlaceholderStage("audioMix", "audio-mix.meta.json", "ffmpegでナレーション、BGM、環境音を合成する予定です。", ["narration.wav", "bgm.wav", "ambient.wav"], ["mix.wav"]),
    new PlaceholderStage("visual", "visual.meta.json", "ComfyUI HTTP APIで映像素材を生成する予定です。フェーズ0はMac完結を前提にします。", ["theme.json"], ["visual.mp4"]),
    new PlaceholderStage("video", "video.meta.json", "ffmpegで映像と音声を尺に合わせて合成する予定です。", ["visual.mp4", "mix.wav"], ["final.mp4"]),
    new PlaceholderStage("metadata", "metadata.meta.json", "タイトル、説明、タグ、サムネ案をLLMで生成する予定です。", ["script.md", "theme.json"], ["metadata.json"]),
    new PlaceholderStage("humanReview", "human-review.meta.json", "人間レビューは自動化しません。品質、権利、効能表現を手動確認してください。", ["final.mp4", "metadata.json", "license.json"], ["review.json"], "manual-required"),
    new PlaceholderStage("publish", "publish.meta.json", "投稿は初期は手動、将来はYouTube Data API v3で接続します。", ["final.mp4", "metadata.json", "review.json"], ["publish.json"], "manual-required")
  ];
}
