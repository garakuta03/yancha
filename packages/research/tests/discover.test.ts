import { discoverCandidates } from "../src/discover.js";
import type { ChannelSnapshot, KeywordsSettings } from "../src/types.js";

const settings: KeywordsSettings = {
  minSubscribers: 100,
  maxCandidatesPerRun: 2,
  relevanceLanguage: "ja",
  regionCode: "JP",
  quotaGuardUnits: 3000
};

function channel(id: string, subs: number): ChannelSnapshot {
  return {
    channelId: id,
    title: `t-${id}`,
    subscriberCount: subs,
    viewCount: 0,
    videoCount: 0,
    capturedAt: "2026-07-16T00:00:00.000Z"
  };
}

const client = {
  async searchChannels(keyword: string) {
    if (keyword === "睡眠導入") {
      return [{ channelId: "UCa", title: "a" }, { channelId: "UCb", title: "b" }, { channelId: "UCdup", title: "dup" }];
    }
    return [{ channelId: "UCc", title: "c" }, { channelId: "UClow", title: "low" }];
  },
  async fetchChannels(ids: readonly string[]) {
    const table: Record<string, number> = { UCa: 5000, UCb: 3000, UCc: 1000, UClow: 50, UCdup: 9000 };
    return ids.map((id) => channel(id, table[id] ?? 0));
  }
};

describe("discoverCandidates", () => {
  test("重複/既存/登録者下限で絞り、登録者降順に上限件数を返す", async () => {
    const result = await discoverCandidates({
      keywords: ["睡眠導入", "ヒーリング"],
      settings,
      client,
      existingChannelIds: new Set(["UCdup"]),
      confirmed: false
    });

    expect(result.map((candidate) => candidate.channelId)).toEqual(["UCa", "UCb"]);
    expect(result[0]?.matchedKeywords).toContain("睡眠導入");
  });

  test("クォータ見積り超過かつ未承認なら例外", async () => {
    const many = Array.from({ length: 40 }, (_, i) => `kw${i}`);
    await expect(discoverCandidates({
      keywords: many,
      settings,
      client,
      existingChannelIds: new Set(),
      confirmed: false
    })).rejects.toThrow(/クォータ|ユニット/);
  });
});
