import type { LlmClient } from "../clients/llm.js";
import type { StageRunner } from "../types/pipeline.js";
import { PlaceholderStage } from "./placeholders.js";
import { SceneStage } from "./scene.js";
import { ThemeStage } from "./theme.js";

export function createStageRunners(llmClient: LlmClient): readonly StageRunner[] {
  return [
    new ThemeStage(),
    new SceneStage(llmClient),
    new PlaceholderStage("audio", "audio.meta.json", "scene.jsonから環境音WAVを生成する予定です。", ["scene.json"], ["ambient.wav"]),
    new PlaceholderStage("visual", "visual.meta.json", "scene.jsonから完全ループ映像を生成する予定です。", ["scene.json"], ["visual-loop.mp4"]),
    new PlaceholderStage("video", "video.meta.json", "ffmpegでループ映像と環境音を尺に合わせて合成する予定です。", ["visual-loop.mp4", "ambient.wav"], ["final.mp4"]),
    new PlaceholderStage("metadata", "metadata.meta.json", "scene.jsonからタイトル、説明、タグ、サムネ案を生成する予定です。", ["scene.json"], ["metadata.json"]),
    new PlaceholderStage("checks", "checks.meta.json", "効能表現、固有性、音量などの自動チェックを実行する予定です。", ["metadata.json", "uniqueness.json", "final.mp4"], ["checks.json"]),
    new PlaceholderStage("upload", "upload.meta.json", "YouTubeへ限定公開アップロードする予定です。", ["final.mp4", "metadata.json", "checks.json"], ["upload.json"], "manual-required"),
    new PlaceholderStage("review", "review.meta.json", "限定公開URLとチェック結果を人間レビュー用にまとめる予定です。", ["upload.json", "checks.json", "license.json"], ["review.md"], "manual-required")
  ];
}
