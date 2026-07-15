import { resolve } from "node:path";
import type { AppConfig } from "./config.js";

export interface VideoPaths {
  readonly videoId: string;
  readonly videoDir: string;
  readonly themeJson: string;
  readonly scriptMarkdown: string;
  readonly scriptMetaJson: string;
  readonly licenseJson: string;
}

export function resolveVideoPaths(config: AppConfig, videoId: string): VideoPaths {
  const videoDir = resolve(config.assetsDir, videoId);
  return {
    videoId,
    videoDir,
    themeJson: resolve(videoDir, "theme.json"),
    scriptMarkdown: resolve(videoDir, "script.md"),
    scriptMetaJson: resolve(videoDir, "script.meta.json"),
    licenseJson: resolve(videoDir, "license.json")
  };
}
