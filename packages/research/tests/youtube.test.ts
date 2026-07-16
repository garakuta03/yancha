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

describe("createYoutubeClient.searchChannels", () => {
  test("type=channel/q/relevanceLanguage/regionCode を付けてchannelIdを返す", async () => {
    let calledUrl = "";
    const fakeFetch: typeof fetch = async (input) => {
      calledUrl = String(input);
      return new Response(JSON.stringify({
        items: [
          { id: { kind: "youtube#channel", channelId: "UCsleep" }, snippet: { title: "眠れるCH" } }
        ]
      }), { status: 200 });
    };
    const client = createYoutubeClient(config, fakeFetch);
    const results = await client.searchChannels("睡眠導入", { relevanceLanguage: "ja", regionCode: "JP" });
    expect(calledUrl).toContain("/search");
    expect(calledUrl).toContain("type=channel");
    expect(calledUrl).toContain("relevanceLanguage=ja");
    expect(calledUrl).toContain("regionCode=JP");
    expect(results).toEqual([{ channelId: "UCsleep", title: "眠れるCH" }]);
  });
});

describe("createYoutubeClient.fetchVideos", () => {
  // videos.list は id フィルタと maxResults を併用できず、id は最大50件。
  test("maxResultsを付けず、50件超のidは分割して全件取得する", async () => {
    const calledUrls: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      calledUrls.push(url.toString());
      const ids = (url.searchParams.get("id") ?? "").split(",").filter((id) => id.length > 0);
      const items = ids.map((id) => ({
        id,
        snippet: { channelId: "UCx", title: `t-${id}`, publishedAt: "2026-07-01T00:00:00Z", tags: [] },
        statistics: { viewCount: "1" },
        contentDetails: { duration: "PT1H" }
      }));
      return new Response(JSON.stringify({ items }), { status: 200 });
    };
    const client = createYoutubeClient(config, fakeFetch);
    const videoIds = Array.from({ length: 60 }, (_, i) => `v${i}`);

    const videos = await client.fetchVideos(videoIds);

    // 60件 → 50+10 の2回に分割
    expect(calledUrls).toHaveLength(2);
    // videos.list に maxResults を付けない（id併用で400になるため）
    for (const url of calledUrls) {
      expect(url).not.toContain("maxResults");
      expect((url.match(/[?&]id=([^&]*)/)?.[1] ?? "").split(",").length).toBeLessThanOrEqual(50);
    }
    // 全件マップされる
    expect(videos).toHaveLength(60);
    expect(videos[0]?.durationSeconds).toBe(3600);
  });
});
