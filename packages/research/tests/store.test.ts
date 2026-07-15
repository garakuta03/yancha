import { createSqliteStore } from "../src/store.js";
import type { SnapshotBatch } from "../src/types.js";

function batch(capturedAt: string, channelViews: number, videoViews: number): SnapshotBatch {
  return {
    capturedAt,
    channels: [{ channelId: "UCaaa", title: "眠り", subscriberCount: 1000, viewCount: channelViews, videoCount: 10, capturedAt }],
    videos: [{ videoId: "v1", channelId: "UCaaa", title: "湖畔の夜", publishedAt: "2026-07-01T00:00:00Z", durationSeconds: 3600, viewCount: videoViews, tags: ["sleep"], capturedAt }]
  };
}

describe("SQLite ResearchStore", () => {
  test("バッチを追記し最新2件を新しい順で取得できる", () => {
    const store = createSqliteStore(":memory:");
    store.saveBatch(batch("2026-07-14T00:00:00.000Z", 50000, 100));
    store.saveBatch(batch("2026-07-16T00:00:00.000Z", 50600, 220));

    const two = store.latestTwoChannelSnapshots("UCaaa");
    expect(two).toHaveLength(2);
    expect(two[0]?.capturedAt).toBe("2026-07-16T00:00:00.000Z");
    expect(two[0]?.viewCount).toBe(50600);
    expect(two[1]?.capturedAt).toBe("2026-07-14T00:00:00.000Z");
    store.close();
  });

  test("最新チャンネル・動画スナップショットを取得できる", () => {
    const store = createSqliteStore(":memory:");
    store.saveBatch(batch("2026-07-16T00:00:00.000Z", 50600, 220));
    expect(store.allLatestChannelSnapshots()[0]?.viewCount).toBe(50600);
    expect(store.latestVideoSnapshots()[0]?.durationSeconds).toBe(3600);
    store.close();
  });
});
