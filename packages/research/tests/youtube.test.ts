import { createYoutubeClient, parseIsoDurationToSeconds } from "../src/youtube.js";
import type { ResearchConfig } from "../src/config.js";

const config = {
  youtubeApiKey: "k",
  youtubeBaseUrl: "https://example.test/youtube/v3",
  dataDir: "research-data",
  logLevel: "info"
} satisfies ResearchConfig;

describe("parseIsoDurationToSeconds", () => {
  test("PT3H2M1S=10921秒", () => {
    expect(parseIsoDurationToSeconds("PT3H2M1S")).toBe(10921);
  });

  test("PT8H=28800秒", () => {
    expect(parseIsoDurationToSeconds("PT8H")).toBe(28800);
  });

  test("PT45S=45秒", () => {
    expect(parseIsoDurationToSeconds("PT45S")).toBe(45);
  });
});

describe("createYoutubeClient.fetchChannels", () => {
  test("APIキーを付与しstatistics/snippetをマップする", async () => {
    let calledUrl = "";
    const fakeFetch: typeof fetch = async (input) => {
      calledUrl = String(input);
      return new Response(JSON.stringify({
        items: [{
          id: "UCaaa",
          snippet: { title: "眠りチャンネル" },
          statistics: { subscriberCount: "1000", viewCount: "50000", videoCount: "42" }
        }]
      }), { status: 200 });
    };

    const client = createYoutubeClient(config, fakeFetch);
    const channels = await client.fetchChannels(["UCaaa"]);
    expect(calledUrl).toContain("key=k");
    expect(calledUrl).toContain("id=UCaaa");
    expect(channels[0]).toMatchObject({ channelId: "UCaaa", title: "眠りチャンネル", subscriberCount: 1000, viewCount: 50000, videoCount: 42 });
    expect(typeof channels[0]?.capturedAt).toBe("string");
  });

  test("HTTPエラーはYanchaErrorに変換する", async () => {
    const fakeFetch: typeof fetch = async () => new Response("quota exceeded", { status: 403 });
    const client = createYoutubeClient(config, fakeFetch);
    await expect(client.fetchChannels(["UCaaa"])).rejects.toThrow(/403/);
  });
});
