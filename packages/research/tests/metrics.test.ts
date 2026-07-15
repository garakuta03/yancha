import { channelViewVelocityPerDay, durationBuckets, topWords } from "../src/metrics.js";
import type { ChannelSnapshot, VideoSnapshot } from "../src/types.js";

function ch(capturedAt: string, viewCount: number): ChannelSnapshot {
  return { channelId: "UCaaa", title: "眠り", subscriberCount: 1000, viewCount, videoCount: 10, capturedAt };
}

function vid(durationSeconds: number, title: string, tags: string[]): VideoSnapshot {
  return { videoId: "v", channelId: "UCaaa", title, publishedAt: "2026-07-01T00:00:00Z", durationSeconds, viewCount: 1, tags, capturedAt: "2026-07-16T00:00:00.000Z" };
}

describe("channelViewVelocityPerDay", () => {
  test("2日で20000増なら1日1万", () => {
    const velocity = channelViewVelocityPerDay(ch("2026-07-14T00:00:00.000Z", 30000), ch("2026-07-16T00:00:00.000Z", 50000));
    expect(velocity).toBe(10000);
  });

  test("経過0以下ならnull", () => {
    expect(channelViewVelocityPerDay(ch("2026-07-16T00:00:00.000Z", 30000), ch("2026-07-16T00:00:00.000Z", 50000))).toBeNull();
  });
});

describe("durationBuckets", () => {
  test("尺をバケットに振り分ける", () => {
    const buckets = durationBuckets([vid(1200, "a", []), vid(7200, "b", []), vid(36000, "c", [])]);
    const map = Object.fromEntries(buckets.map((bucket) => [bucket.label, bucket.count]));
    expect(map["<30m"]).toBe(1);
    expect(map["1-3h"]).toBe(1);
    expect(map["8h+"]).toBe(1);
  });
});

describe("topWords", () => {
  test("タイトルとタグの頻出語を数える", () => {
    const words = topWords([vid(60, "睡眠 音楽", ["睡眠"]), vid(60, "睡眠 雨", ["雨"])], 5);
    const map = Object.fromEntries(words.map((word) => [word.word, word.count]));
    expect(map["睡眠"]).toBe(3);
  });
});
