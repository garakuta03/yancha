import type { AppConfig } from "../config.js";
import type { LlmClient } from "../clients/llm.js";
import type { StageRunner } from "../types/pipeline.js";
import { AudioStage } from "./audio.js";
import { ChecksStage } from "./checks.js";
import { VideoStage } from "./video.js";
import { MetadataStage } from "./metadata.js";
import { ReviewStage } from "./review.js";
import { SceneStage } from "./scene.js";
import { ThemeStage } from "./theme.js";
import { UploadStage } from "./upload.js";
import { VisualStage } from "./visual.js";

export function createStageRunners(llmClient: LlmClient, config: AppConfig, options: { readonly uploadDryRun?: boolean } = {}): readonly StageRunner[] {
  return [
    new ThemeStage(),
    new SceneStage(llmClient),
    new AudioStage(),
    new VisualStage(config.chromeExecutablePath),
    new VideoStage(),
    new MetadataStage(llmClient),
    new ChecksStage(),
    new UploadStage({
      dryRun: options.uploadDryRun ?? false,
      youtubeClientFactory: async () => {
        const { createYoutubeUploadClient } = await import("../clients/youtube.js");
        return createYoutubeUploadClient(config);
      }
    }),
    new ReviewStage()
  ];
}
