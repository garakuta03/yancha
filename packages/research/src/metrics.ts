import type { ChannelSnapshot, VideoSnapshot } from "./types.js";

export interface CountBucket {
  readonly label: string;
  readonly count: number;
}

export interface WordCount {
  readonly word: string;
  readonly count: number;
}

export function channelViewVelocityPerDay(prev: ChannelSnapshot, curr: ChannelSnapshot): number | null {
  const elapsedMs = new Date(curr.capturedAt).getTime() - new Date(prev.capturedAt).getTime();
  if (elapsedMs <= 0) {
    return null;
  }
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return (curr.viewCount - prev.viewCount) / elapsedDays;
}

const bucketDefs: readonly { label: string; maxSeconds: number }[] = [
  { label: "<30m", maxSeconds: 30 * 60 },
  { label: "30-60m", maxSeconds: 60 * 60 },
  { label: "1-3h", maxSeconds: 3 * 3600 },
  { label: "3-8h", maxSeconds: 8 * 3600 },
  { label: "8h+", maxSeconds: Number.POSITIVE_INFINITY }
];

export function durationBuckets(videos: readonly VideoSnapshot[]): CountBucket[] {
  const counts = new Map<string, number>(bucketDefs.map((bucket) => [bucket.label, 0]));
  for (const video of videos) {
    const bucket = bucketDefs.find((candidate) => video.durationSeconds < candidate.maxSeconds) ?? bucketDefs[bucketDefs.length - 1];
    if (!bucket) {
      continue;
    }
    counts.set(bucket.label, (counts.get(bucket.label) ?? 0) + 1);
  }
  return bucketDefs.map((bucket) => ({ label: bucket.label, count: counts.get(bucket.label) ?? 0 }));
}

export function topWords(videos: readonly VideoSnapshot[], limit: number): WordCount[] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    const words = [...video.title.split(/[\s　,、。|｜/]+/), ...video.tags];
    for (const raw of words) {
      const word = raw.trim();
      if (word.length === 0) {
        continue;
      }
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ja"))
    .slice(0, limit);
}
