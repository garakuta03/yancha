import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectSnapshots } from "../src/collect.js";
import { createSqliteStore } from "../src/store.js";
import type { YoutubeClient } from "../src/youtube.js";

const fakeClient: YoutubeClient = {
  async fetchChannels(ids) {
    return ids.map((id) => ({ channelId: id, title: "眠り", subscriberCount: 1000, viewCount: 50000, videoCount: 2, capturedAt: "2026-07-16T00:00:00.000Z" }));
  },
  async fetchUploadsPlaylistId() {
    return "PLuploads";
  },
  async fetchRecentVideoIds() {
    return ["v1", "v2"];
  },
  async fetchVideos(ids) {
    return ids.map((id) => ({ videoId: id, channelId: "UCaaa", title: "湖畔", publishedAt: "2026-07-01T00:00:00Z", durationSeconds: 3600, viewCount: 100, tags: ["sleep"], capturedAt: "2026-07-16T00:00:00.000Z" }));
  }
};

describe("collectSnapshots", () => {
  test("台帳を回してバッチを作りJSON書き出しとstore追記を行う", async () => {
    const dir = await mkdtemp(join(tmpdir(), "collect-"));
    const store = createSqliteStore(":memory:");
    const batch = await collectSnapshots({
      ledger: [{ channelId: "UCaaa", note: "", tags: [] }],
      client: fakeClient,
      store,
      snapshotsDir: dir
    });

    expect(batch.channels).toHaveLength(1);
    expect(batch.videos).toHaveLength(2);
    expect(store.allLatestChannelSnapshots()).toHaveLength(1);
    const subdirs = await readdir(dir);
    expect(subdirs).toHaveLength(1);
    const written = JSON.parse(await readFile(join(dir, subdirs[0] ?? "", "batch.json"), "utf8")) as { videos: unknown[] };
    expect(written.videos).toHaveLength(2);
    store.close();
  });
});
