import { loadResearchConfig } from "../src/config.js";

describe("loadResearchConfig", () => {
  test("YOUTUBE_API_KEY未設定なら例外", () => {
    expect(() => loadResearchConfig({})).toThrow(/YOUTUBE_API_KEY/);
  });

  test("既定値を補完する", () => {
    const config = loadResearchConfig({ YOUTUBE_API_KEY: "k" });
    expect(config.youtubeBaseUrl).toBe("https://www.googleapis.com/youtube/v3");
    expect(config.dataDir).toBe("research-data");
    expect(config.logLevel).toBe("info");
  });
});
