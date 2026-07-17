import { resolve } from "node:path";
import { resolveVideoPaths } from "../src/paths.js";
import type { AppConfig } from "../src/config.js";

describe("resolveVideoPaths", () => {
  test("video_id配下の主要パスを解決する", () => {
    const config = {
      logLevel: "info",
      assetsDir: "assets",
      llm: {
        provider: "mock",
        model: "local-mock",
        openaiBaseUrl: "https://api.openai.com/v1",
        geminiBaseUrl: "https://generativelanguage.googleapis.com/v1beta"
      },
      comfyuiBaseUrl: "http://127.0.0.1:8188",
      ffmpegPath: "ffmpeg"
    } satisfies AppConfig;

    const paths = resolveVideoPaths(config, "video-test");

    expect(paths.videoDir).toBe(resolve("assets", "video-test"));
    expect(paths.themeJson).toBe(resolve("assets", "video-test", "theme.json"));
    expect(paths.sceneJson).toBe(resolve("assets", "video-test", "scene.json"));
    expect(paths.uniquenessJson).toBe(resolve("assets", "video-test", "uniqueness.json"));
    expect(paths.ambientWav).toBe(resolve("assets", "video-test", "ambient.wav"));
    expect(paths.visualMp4).toBe(resolve("assets", "video-test", "visual-loop.mp4"));
    expect(paths.finalMp4).toBe(resolve("assets", "video-test", "final.mp4"));
    expect(paths.metadataJson).toBe(resolve("assets", "video-test", "metadata.json"));
    expect(paths.checksJson).toBe(resolve("assets", "video-test", "checks.json"));
    expect(paths.uploadJson).toBe(resolve("assets", "video-test", "upload.json"));
    expect(paths.reviewMd).toBe(resolve("assets", "video-test", "review.md"));
    expect(paths.licenseJson).toBe(resolve("assets", "video-test", "license.json"));
    expect(paths.logsDir).toBe(resolve("assets", "video-test", "logs"));
  });
});
