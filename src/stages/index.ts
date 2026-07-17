import type { LlmClient } from "../clients/llm.js";
import type { StageRunner } from "../types/pipeline.js";
import { AudioStage } from "./audio.js";
import { ChecksStage } from "./checks.js";
import { VideoStage } from "./video.js";
import { MetadataStage } from "./metadata.js";
import { PlaceholderStage } from "./placeholders.js";
import { SceneStage } from "./scene.js";
import { ThemeStage } from "./theme.js";
import { VisualStage } from "./visual.js";

export function createStageRunners(llmClient: LlmClient): readonly StageRunner[] {
  return [
    new ThemeStage(),
    new SceneStage(llmClient),
    new AudioStage(),
    new VisualStage(),
    new VideoStage(),
    new MetadataStage(llmClient),
    new ChecksStage(),
    new PlaceholderStage("upload", "upload.meta.json", "YouTubeへ限定公開アップロードする予定です。", ["final.mp4", "metadata.json", "checks.json"], ["upload.json"], "manual-required"),
    new PlaceholderStage("review", "review.meta.json", "限定公開URLとチェック結果を人間レビュー用にまとめる予定です。", ["upload.json", "checks.json", "license.json"], ["review.md"], "manual-required")
  ];
}
