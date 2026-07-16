import { YanchaError } from "@yancha/core";
import type { ResearchConfig } from "./config.js";
import type { ChannelSnapshot, VideoSnapshot } from "./types.js";

export interface YoutubeClient {
  fetchChannels(channelIds: readonly string[]): Promise<ChannelSnapshot[]>;
  searchChannels(keyword: string, options: SearchOptions): Promise<{ channelId: string; title: string }[]>;
  fetchUploadsPlaylistId(channelId: string): Promise<string>;
  fetchRecentVideoIds(playlistId: string, max: number): Promise<string[]>;
  fetchVideos(videoIds: readonly string[]): Promise<VideoSnapshot[]>;
}

export interface SearchOptions {
  readonly relevanceLanguage: string;
  readonly regionCode: string;
  readonly maxResults?: number;
}

export function parseIsoDurationToSeconds(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return 0;
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function createYoutubeClient(config: ResearchConfig, fetchImpl: typeof fetch = fetch): YoutubeClient {
  async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${config.youtubeBaseUrl}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("key", config.youtubeApiKey);

    const response = await fetchImpl(url);
    if (!response.ok) {
      const body = await response.text();
      throw new YanchaError("CLIENT_ERROR", `YouTube API エラー(${response.status}): ${body.slice(0, 200)}`);
    }
    return response.json();
  }

  return {
    async fetchChannels(channelIds) {
      if (channelIds.length === 0) {
        return [];
      }
      const capturedAt = new Date().toISOString();
      const json = await getJson("channels", {
        part: "snippet,statistics",
        id: channelIds.join(","),
        maxResults: "50"
      }) as YoutubeChannelsResponse;

      return (json.items ?? []).map((item): ChannelSnapshot => ({
        channelId: item.id,
        title: item.snippet?.title ?? "",
        subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        videoCount: Number(item.statistics?.videoCount ?? 0),
        capturedAt
      }));
    },

    async searchChannels(keyword, options) {
      const json = await getJson("search", {
        part: "snippet",
        type: "channel",
        q: keyword,
        maxResults: String(options.maxResults ?? 50),
        relevanceLanguage: options.relevanceLanguage,
        regionCode: options.regionCode
      }) as YoutubeSearchResponse;

      return (json.items ?? [])
        .map((item) => ({ channelId: item.id?.channelId ?? "", title: item.snippet?.title ?? "" }))
        .filter((result): result is { channelId: string; title: string } => result.channelId.length > 0);
    },

    async fetchUploadsPlaylistId(channelId) {
      const json = await getJson("channels", {
        part: "contentDetails",
        id: channelId
      }) as YoutubeChannelsResponse;

      const playlistId = json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!playlistId) {
        throw new YanchaError("CLIENT_ERROR", `アップロード用プレイリストが取得できません: ${channelId}`);
      }
      return playlistId;
    },

    async fetchRecentVideoIds(playlistId, max) {
      const json = await getJson("playlistItems", {
        part: "contentDetails",
        playlistId,
        maxResults: String(Math.min(max, 50))
      }) as YoutubePlaylistItemsResponse;

      return (json.items ?? [])
        .map((item) => item.contentDetails?.videoId)
        .filter((videoId): videoId is string => typeof videoId === "string");
    },

    async fetchVideos(videoIds) {
      if (videoIds.length === 0) {
        return [];
      }
      const capturedAt = new Date().toISOString();
      const json = await getJson("videos", {
        part: "snippet,statistics,contentDetails",
        id: videoIds.join(","),
        maxResults: "50"
      }) as YoutubeVideosResponse;

      return (json.items ?? []).map((item): VideoSnapshot => ({
        videoId: item.id,
        channelId: item.snippet?.channelId ?? "",
        title: item.snippet?.title ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        durationSeconds: parseIsoDurationToSeconds(item.contentDetails?.duration ?? "PT0S"),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        tags: item.snippet?.tags ?? [],
        capturedAt
      }));
    }
  };
}

interface YoutubeChannelsResponse {
  readonly items?: readonly {
    readonly id: string;
    readonly snippet?: {
      readonly title?: string;
    };
    readonly statistics?: {
      readonly subscriberCount?: string;
      readonly viewCount?: string;
      readonly videoCount?: string;
    };
    readonly contentDetails?: {
      readonly relatedPlaylists?: {
        readonly uploads?: string;
      };
    };
  }[];
}

interface YoutubeSearchResponse {
  readonly items?: readonly {
    readonly id?: {
      readonly channelId?: string;
    };
    readonly snippet?: {
      readonly title?: string;
    };
  }[];
}

interface YoutubePlaylistItemsResponse {
  readonly items?: readonly {
    readonly contentDetails?: {
      readonly videoId?: string;
    };
  }[];
}

interface YoutubeVideosResponse {
  readonly items?: readonly {
    readonly id: string;
    readonly snippet?: {
      readonly channelId?: string;
      readonly title?: string;
      readonly publishedAt?: string;
      readonly tags?: readonly string[];
    };
    readonly statistics?: {
      readonly viewCount?: string;
    };
    readonly contentDetails?: {
      readonly duration?: string;
    };
  }[];
}
