import { createServer } from "../src/server.js";
import { createSqliteStore } from "../src/store.js";
import type { SnapshotBatch } from "../src/types.js";

const batch: SnapshotBatch = {
  capturedAt: "2026-07-16T00:00:00.000Z",
  channels: [{ channelId: "UCaaa", title: "眠り", subscriberCount: 1000, viewCount: 50000, videoCount: 10, capturedAt: "2026-07-16T00:00:00.000Z" }],
  videos: [{ videoId: "v1", channelId: "UCaaa", title: "睡眠 音楽", publishedAt: "2026-07-01T00:00:00Z", durationSeconds: 3600, viewCount: 100, tags: ["睡眠"], capturedAt: "2026-07-16T00:00:00.000Z" }]
};

describe("createServer", () => {
  test("GET /api/report がReportData JSONを返す", async () => {
    const store = createSqliteStore(":memory:");
    store.saveBatch(batch);
    const app = createServer(store);
    const res = await app.request("/api/report");
    expect(res.status).toBe(200);
    const json = await res.json() as { channels: { channelId: string }[]; durationBuckets: unknown[] };
    expect(json.channels[0]?.channelId).toBe("UCaaa");
    expect(Array.isArray(json.durationBuckets)).toBe(true);
    store.close();
  });

  test("GET / がHTMLを返す", async () => {
    const store = createSqliteStore(":memory:");
    const app = createServer(store);
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    store.close();
  });
});
