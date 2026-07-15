import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { ChannelSnapshot, SnapshotBatch, VideoSnapshot } from "./types.js";

export interface ResearchStore {
  saveBatch(batch: SnapshotBatch): void;
  latestTwoChannelSnapshots(channelId: string): ChannelSnapshot[];
  allLatestChannelSnapshots(): ChannelSnapshot[];
  latestVideoSnapshots(): VideoSnapshot[];
  close(): void;
}

export function createSqliteStore(dbFile: string): ResearchStore {
  if (dbFile !== ":memory:") {
    mkdirSync(dirname(dbFile), { recursive: true });
  }
  const db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_snapshots (
      channel_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subscriber_count INTEGER NOT NULL,
      view_count INTEGER NOT NULL,
      video_count INTEGER NOT NULL,
      captured_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS video_snapshots (
      video_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      view_count INTEGER NOT NULL,
      tags TEXT NOT NULL,
      captured_at TEXT NOT NULL
    );
  `);

  const insertChannel = db.prepare(`
    INSERT INTO channel_snapshots (channel_id, title, subscriber_count, view_count, video_count, captured_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertVideo = db.prepare(`
    INSERT INTO video_snapshots (video_id, channel_id, title, published_at, duration_seconds, view_count, tags, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return {
    saveBatch(batch) {
      const transaction = db.transaction((target: SnapshotBatch) => {
        for (const channel of target.channels) {
          insertChannel.run(channel.channelId, channel.title, channel.subscriberCount, channel.viewCount, channel.videoCount, channel.capturedAt);
        }
        for (const video of target.videos) {
          insertVideo.run(video.videoId, video.channelId, video.title, video.publishedAt, video.durationSeconds, video.viewCount, JSON.stringify(video.tags), video.capturedAt);
        }
      });
      transaction(batch);
    },

    latestTwoChannelSnapshots(channelId) {
      const rows = db.prepare("SELECT * FROM channel_snapshots WHERE channel_id = ? ORDER BY captured_at DESC LIMIT 2").all(channelId);
      return rows.map(mapChannelRow);
    },

    allLatestChannelSnapshots() {
      const rows = db.prepare(`
        SELECT cs.* FROM channel_snapshots cs
        JOIN (
          SELECT channel_id, MAX(captured_at) AS max_captured_at
          FROM channel_snapshots
          GROUP BY channel_id
        ) latest
        ON cs.channel_id = latest.channel_id AND cs.captured_at = latest.max_captured_at
        ORDER BY cs.view_count DESC
      `).all();
      return rows.map(mapChannelRow);
    },

    latestVideoSnapshots() {
      const rows = db.prepare(`
        SELECT vs.* FROM video_snapshots vs
        JOIN (
          SELECT video_id, MAX(captured_at) AS max_captured_at
          FROM video_snapshots
          GROUP BY video_id
        ) latest
        ON vs.video_id = latest.video_id AND vs.captured_at = latest.max_captured_at
        ORDER BY vs.view_count DESC
      `).all();
      return rows.map(mapVideoRow);
    },

    close() {
      db.close();
    }
  };
}

function mapChannelRow(row: unknown): ChannelSnapshot {
  const typed = row as ChannelRow;
  return {
    channelId: typed.channel_id,
    title: typed.title,
    subscriberCount: typed.subscriber_count,
    viewCount: typed.view_count,
    videoCount: typed.video_count,
    capturedAt: typed.captured_at
  };
}

function mapVideoRow(row: unknown): VideoSnapshot {
  const typed = row as VideoRow;
  return {
    videoId: typed.video_id,
    channelId: typed.channel_id,
    title: typed.title,
    publishedAt: typed.published_at,
    durationSeconds: typed.duration_seconds,
    viewCount: typed.view_count,
    tags: JSON.parse(typed.tags) as string[],
    capturedAt: typed.captured_at
  };
}

interface ChannelRow {
  readonly channel_id: string;
  readonly title: string;
  readonly subscriber_count: number;
  readonly view_count: number;
  readonly video_count: number;
  readonly captured_at: string;
}

interface VideoRow {
  readonly video_id: string;
  readonly channel_id: string;
  readonly title: string;
  readonly published_at: string;
  readonly duration_seconds: number;
  readonly view_count: number;
  readonly tags: string;
  readonly captured_at: string;
}
