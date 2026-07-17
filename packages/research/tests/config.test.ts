import { loadResearchConfig } from "../src/config.js";

describe("loadResearchConfig", () => {
  test("YOUTUBE_API_KEY未設定なら例外", () => {
    expect(() => loadResearchConfig({})).toThrow(/YOUTUBE_API_KEY/);
  });

  test("既定値を補完する", () => {
    const config = loadResearchConfig({ YOUTUBE_API_KEY: "k" });
    expect(config.youtubeBaseUrl).toBe("https://www.googleapis.com/youtube/v3");
    expect(config.dataDir).toBe("research-data");
    expect(config.assetsDir).toMatch(/assets$/);
    expect(config.logLevel).toBe("info");
  });

  test("assetsDirを環境変数から解決する", () => {
    const config = loadResearchConfig({ YOUTUBE_API_KEY: "k", YANCHA_ASSETS_DIR: "tmp-assets" });
    expect(config.assetsDir).toMatch(/tmp-assets$/);
  });
});
