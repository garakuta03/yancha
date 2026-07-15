export interface LedgerEntry {
  readonly channelId: string;
  readonly note: string;
  readonly tags: readonly string[];
  readonly addedAt?: string;
}

export interface ChannelSnapshot {
  readonly channelId: string;
  readonly title: string;
  readonly subscriberCount: number;
  readonly viewCount: number;
  readonly videoCount: number;
  readonly capturedAt: string;
}

export interface VideoSnapshot {
  readonly videoId: string;
  readonly channelId: string;
  readonly title: string;
  readonly publishedAt: string;
  readonly durationSeconds: number;
  readonly viewCount: number;
  readonly tags: readonly string[];
  readonly capturedAt: string;
}

export interface SnapshotBatch {
  readonly capturedAt: string;
  readonly channels: readonly ChannelSnapshot[];
  readonly videos: readonly VideoSnapshot[];
}
