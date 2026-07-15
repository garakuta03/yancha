import { channelViewVelocityPerDay, durationBuckets, topWords } from "./metrics.js";
import type { CountBucket, WordCount } from "./metrics.js";
import type { ResearchStore } from "./store.js";

export interface ReportChannelRow {
  readonly channelId: string;
  readonly title: string;
  readonly subscriberCount: number;
  readonly viewCount: number;
  readonly velocityPerDay: number | null;
}

export interface ReportData {
  readonly channels: readonly ReportChannelRow[];
  readonly durationBuckets: readonly CountBucket[];
  readonly topWords: readonly WordCount[];
}

export function buildReport(store: ResearchStore, topWordLimit = 20): ReportData {
  const latestChannels = store.allLatestChannelSnapshots();
  const channels = latestChannels.map((curr): ReportChannelRow => {
    const two = store.latestTwoChannelSnapshots(curr.channelId);
    const velocityPerDay = two.length === 2 && two[0] && two[1] ? channelViewVelocityPerDay(two[1], two[0]) : null;
    return {
      channelId: curr.channelId,
      title: curr.title,
      subscriberCount: curr.subscriberCount,
      viewCount: curr.viewCount,
      velocityPerDay
    };
  });

  const videos = store.latestVideoSnapshots();
  return {
    channels,
    durationBuckets: durationBuckets(videos),
    topWords: topWords(videos, topWordLimit)
  };
}
