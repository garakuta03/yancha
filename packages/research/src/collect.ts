import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ResearchStore } from "./store.js";
import type { LedgerEntry, SnapshotBatch, VideoSnapshot } from "./types.js";
import type { YoutubeClient } from "./youtube.js";

export interface CollectDeps {
  readonly ledger: readonly LedgerEntry[];
  readonly client: YoutubeClient;
  readonly store: ResearchStore;
  readonly snapshotsDir: string;
  readonly maxVideosPerChannel?: number;
}

export async function collectSnapshots(deps: CollectDeps): Promise<SnapshotBatch> {
  const capturedAt = new Date().toISOString();
  const maxVideos = deps.maxVideosPerChannel ?? 20;
  const channelIds = deps.ledger.map((entry) => entry.channelId);

  const rawChannels = await deps.client.fetchChannels(channelIds);
  const videoIds: string[] = [];

  for (const channelId of channelIds) {
    const playlistId = await deps.client.fetchUploadsPlaylistId(channelId);
    const ids = await deps.client.fetchRecentVideoIds(playlistId, maxVideos);
    videoIds.push(...ids);
  }

  const rawVideos = await deps.client.fetchVideos(videoIds);
  const channels = rawChannels.map((channel) => ({ ...channel, capturedAt }));
  const videos: VideoSnapshot[] = rawVideos.map((video) => ({ ...video, capturedAt }));
  const batch: SnapshotBatch = { capturedAt, channels, videos };

  const safe = capturedAt.replace(/:/g, "");
  const outDir = join(deps.snapshotsDir, safe);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "batch.json"), `${JSON.stringify(batch, null, 2)}\n`, "utf8");

  deps.store.saveBatch(batch);
  return batch;
}
