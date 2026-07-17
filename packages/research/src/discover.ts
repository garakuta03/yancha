import { YanchaError } from "@yancha/core";
import { estimateSearchCalls, estimateStatUnits } from "./keywords.js";
import type { YoutubeClient } from "./youtube.js";
import type { Candidate, KeywordsSettings } from "./types.js";

export interface DiscoverDeps {
  readonly keywords: readonly string[];
  readonly settings: KeywordsSettings;
  readonly client: Pick<YoutubeClient, "searchChannels" | "fetchChannels">;
  readonly existingChannelIds: ReadonlySet<string>;
  readonly confirmed: boolean;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function discoverCandidates(deps: DiscoverDeps): Promise<Candidate[]> {
  const estimatedSearchCalls = estimateSearchCalls(deps.keywords.length);
  if (estimatedSearchCalls > deps.settings.searchCallGuardPerDay && !deps.confirmed) {
    throw new YanchaError(
      "POLICY_VIOLATION",
      `search.list呼び出し回数 ${estimatedSearchCalls} が1日の専用枠 ${deps.settings.searchCallGuardPerDay}回/日 を超えます。--yes で続行してください。`
    );
  }

  const discoveredAt = new Date().toISOString();
  const matched = new Map<string, Set<string>>();
  const titles = new Map<string, string>();
  for (const keyword of deps.keywords) {
    const results = await deps.client.searchChannels(keyword, {
      relevanceLanguage: deps.settings.relevanceLanguage,
      regionCode: deps.settings.regionCode
    });
    for (const result of results) {
      if (deps.existingChannelIds.has(result.channelId)) {
        continue;
      }
      if (!matched.has(result.channelId)) {
        matched.set(result.channelId, new Set());
        titles.set(result.channelId, result.title);
      }
      matched.get(result.channelId)?.add(keyword);
    }
  }

  const uniqueIds = [...matched.keys()];
  if (uniqueIds.length === 0) {
    return [];
  }

  const estimatedStatUnits = estimateStatUnits(uniqueIds.length);
  if (estimatedStatUnits > deps.settings.unitGuard && !deps.confirmed) {
    throw new YanchaError(
      "POLICY_VIOLATION",
      `channels.listのユニット見積り ${estimatedStatUnits} が上限 ${deps.settings.unitGuard} を超えます。--yes で続行してください。`
    );
  }

  const stats = new Map<string, { subscriberCount: number; title: string }>();
  for (const ids of chunk(uniqueIds, 50)) {
    const channels = await deps.client.fetchChannels(ids);
    for (const channel of channels) {
      stats.set(channel.channelId, { subscriberCount: channel.subscriberCount, title: channel.title });
    }
  }

  return uniqueIds
    .map((channelId): Candidate => {
      const stat = stats.get(channelId);
      return {
        channelId,
        title: stat?.title ?? titles.get(channelId) ?? "",
        subscriberCount: stat?.subscriberCount ?? 0,
        matchedKeywords: [...(matched.get(channelId) ?? [])],
        discoveredAt
      };
    })
    .filter((candidate) => candidate.subscriberCount >= deps.settings.minSubscribers)
    .filter((candidate) => candidate.subscriberCount <= deps.settings.maxSubscribers)
    .sort((a, b) => {
      const keywordDiff = b.matchedKeywords.length - a.matchedKeywords.length;
      if (keywordDiff !== 0) {
        return keywordDiff;
      }
      return b.subscriberCount - a.subscriberCount;
    })
    .slice(0, deps.settings.maxCandidatesPerRun);
}
