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

  test("動画レビューを登録・更新・一覧取得できる", () => {
    const store = createSqliteStore(":memory:");
    store.setVideoReviewed("vid-1", "2026-07-17T01:00:00.000Z", "確認済み");
    expect(store.getVideoReview("vid-1")).toEqual({
      videoId: "vid-1",
      reviewedAt: "2026-07-17T01:00:00.000Z",
      note: "確認済み"
    });

    store.setVideoReviewed("vid-1", "2026-07-17T02:00:00.000Z");
    store.setVideoReviewed("vid-2", "2026-07-17T01:30:00.000Z", "保留なし");

    expect(store.getVideoReview("vid-1")).toEqual({
      videoId: "vid-1",
      reviewedAt: "2026-07-17T02:00:00.000Z",
      note: null
    });
    expect(store.listVideoReviews().map((review) => review.videoId)).toEqual(["vid-1", "vid-2"]);
    store.close();
  });
});
