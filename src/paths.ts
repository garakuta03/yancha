import { resolve } from "node:path";
import type { AppConfig } from "./config.js";

export interface VideoPaths {
  readonly videoId: string;
  readonly videoDir: string;
  readonly themeJson: string;
  readonly sceneJson: string;
  readonly uniquenessJson: string;
  readonly ambientWav: string;
  readonly visualMp4: string;
  readonly finalMp4: string;
  readonly metadataJson: string;
  readonly checksJson: string;
  readonly uploadJson: string;
  readonly reviewMd: string;
  readonly licenseJson: string;
  readonly logsDir: string;
}

export function resolveVideoPaths(config: AppConfig, videoId: string): VideoPaths {
  const videoDir = resolve(config.assetsDir, videoId);
  return {
    videoId,
    videoDir,
    themeJson: resolve(videoDir, "theme.json"),
    sceneJson: resolve(videoDir, "scene.json"),
    uniquenessJson: resolve(videoDir, "uniqueness.json"),
    ambientWav: resolve(videoDir, "ambient.wav"),
    visualMp4: resolve(videoDir, "visual-loop.mp4"),
    finalMp4: resolve(videoDir, "final.mp4"),
    metadataJson: resolve(videoDir, "metadata.json"),
    checksJson: resolve(videoDir, "checks.json"),
    uploadJson: resolve(videoDir, "upload.json"),
    reviewMd: resolve(videoDir, "review.md"),
    licenseJson: resolve(videoDir, "license.json"),
    logsDir: resolve(videoDir, "logs")
  };
}
