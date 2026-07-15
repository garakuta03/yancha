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
    expect(paths.scriptMarkdown).toBe(resolve("assets", "video-test", "script.md"));
    expect(paths.scriptMetaJson).toBe(resolve("assets", "video-test", "script.meta.json"));
    expect(paths.licenseJson).toBe(resolve("assets", "video-test", "license.json"));
  });
});
