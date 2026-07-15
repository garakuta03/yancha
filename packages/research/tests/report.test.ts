import { buildReport } from "../src/report.js";
import { createSqliteStore } from "../src/store.js";
import type { SnapshotBatch } from "../src/types.js";

function batch(capturedAt: string, channelViews: number): SnapshotBatch {
  return {
    capturedAt,
    channels: [{ channelId: "UCaaa", title: "眠り", subscriberCount: 1000, viewCount: channelViews, videoCount: 10, capturedAt }],
    videos: [{ videoId: "v1", channelId: "UCaaa", title: "睡眠 音楽", publishedAt: "2026-07-01T00:00:00Z", durationSeconds: 3600, viewCount: 100, tags: ["睡眠"], capturedAt }]
  };
}

describe("buildReport", () => {
  test("チャンネル伸び率・尺分布・頻出語を集計する", () => {
    const store = createSqliteStore(":memory:");
    store.saveBatch(batch("2026-07-14T00:00:00.000Z", 30000));
    store.saveBatch(batch("2026-07-16T00:00:00.000Z", 50000));
    const report = buildReport(store, 5);
    expect(report.channels[0]?.velocityPerDay).toBe(10000);
    expect(report.durationBuckets.find((bucket) => bucket.label === "1-3h")?.count).toBe(1);
    expect(report.topWords.find((word) => word.word === "睡眠")?.count).toBe(2);
    store.close();
  });
});
