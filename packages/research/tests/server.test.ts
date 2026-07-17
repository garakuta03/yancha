import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  test("動画APIとレビュー記録APIを返す", async () => {
    const assetsDir = await mkdtemp(join(tmpdir(), "yancha-server-assets-"));
    const videoDir = join(assetsDir, "vid-1");
    await mkdir(videoDir);
    await writeFile(join(videoDir, "checks.json"), JSON.stringify({
      videoId: "vid-1",
      stageId: "checks",
      createdAt: "2026-07-17T00:00:00.000Z",
      data: { passed: true, results: [] }
    }), "utf8");

    const store = createSqliteStore(":memory:");
    const app = createServer(store, { assetsDir, now: () => "2026-07-17T03:00:00.000Z" });

    const listRes = await app.request("/api/videos");
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json() as { videoId: string; checksPassed: boolean }[];
    expect(listJson[0]).toMatchObject({ videoId: "vid-1", checksPassed: true });

    const reviewRes = await app.request("/api/videos/vid-1/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "目視確認済み" })
    });
    expect(reviewRes.status).toBe(200);
    expect(store.getVideoReview("vid-1")).toEqual({
      videoId: "vid-1",
      reviewedAt: "2026-07-17T03:00:00.000Z",
      note: "目視確認済み"
    });
    store.close();
  });
});
