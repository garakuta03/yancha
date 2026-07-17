import { discoverCandidates } from "../src/discover.js";
import type { ChannelSnapshot, KeywordsSettings } from "../src/types.js";

const settings: KeywordsSettings = {
  minSubscribers: 100,
  maxSubscribers: 300000,
  maxCandidatesPerRun: 2,
  relevanceLanguage: "ja",
  regionCode: "JP",
  searchCallGuardPerDay: 100,
  unitGuard: 10000
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
    // UCa は「ヒーリング」にもヒットさせ、2キーワード一致にする（ソート優先度の検証用）
    return [{ channelId: "UCc", title: "c" }, { channelId: "UClow", title: "low" }, { channelId: "UCa", title: "a" }];
  },
  async fetchChannels(ids: readonly string[]) {
    const table: Record<string, number> = { UCa: 5000, UCb: 3000, UCc: 1000, UClow: 50, UCdup: 9000 };
    return ids.map((id) => channel(id, table[id] ?? 0));
  }
};

describe("discoverCandidates", () => {
  test("重複/既存/登録者下限で絞り、複数キーワード一致を優先して上限件数を返す", async () => {
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

  test("登録者上限を超えるチャンネルを除外する", async () => {
    const result = await discoverCandidates({
      keywords: ["睡眠導入", "ヒーリング"],
      settings: { ...settings, maxSubscribers: 4000 },
      client,
      existingChannelIds: new Set(["UCdup"]),
      confirmed: false
    });

    expect(result.map((candidate) => candidate.channelId)).toEqual(["UCb", "UCc"]);
  });

  test("matchedKeywords 件数が多いチャンネルを登録者数より優先する", async () => {
    const result = await discoverCandidates({
      keywords: ["睡眠導入", "ヒーリング"],
      settings: { ...settings, maxCandidatesPerRun: 3 },
      client,
      existingChannelIds: new Set(),
      confirmed: false
    });

    // UCa(2キーワード一致・5000) が UCdup(1キーワード・9000) より上位＝件数が登録者数に優先する
    expect(result.map((candidate) => candidate.channelId)).toEqual(["UCa", "UCdup", "UCb"]);
    expect(result[0]?.matchedKeywords).toEqual(["睡眠導入", "ヒーリング"]);
  });

  test("search.list呼び出し回数が専用枠を超過かつ未承認なら例外", async () => {
    const many = Array.from({ length: 101 }, (_, i) => `kw${i}`);
    await expect(discoverCandidates({
      keywords: many,
      settings,
      client,
      existingChannelIds: new Set(),
      confirmed: false
    })).rejects.toThrow(/search\.list呼び出し回数/);
  });

  test("channels.listユニット見積り超過かつ未承認なら例外", async () => {
    const fetchChannels = vi.fn(async (ids: readonly string[]) => ids.map((id) => channel(id, 1000)));
    const statGuardClient = {
      async searchChannels() {
        return Array.from({ length: 51 }, (_, i) => ({ channelId: `UC${i}`, title: `t-${i}` }));
      },
      fetchChannels
    };

    await expect(discoverCandidates({
      keywords: ["睡眠導入"],
      settings: { ...settings, unitGuard: 1 },
      client: statGuardClient,
      existingChannelIds: new Set(),
      confirmed: false
    })).rejects.toThrow(/channels\.listのユニット見積り/);
    expect(fetchChannels).not.toHaveBeenCalled();
  });
});
