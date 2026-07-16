import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addCandidates, readCandidates, removeCandidate } from "../src/candidates.js";
import type { Candidate } from "../src/types.js";

function cand(channelId: string): Candidate {
  return {
    channelId,
    title: "眠り",
    subscriberCount: 1000,
    matchedKeywords: ["睡眠導入"],
    discoveredAt: "2026-07-16T00:00:00.000Z"
  };
}

describe("candidates 読み書き", () => {
  test("無ければ空配列", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cand-"));
    expect(await readCandidates(join(dir, "candidates.yaml"))).toEqual([]);
  });

  test("追加は重複を排除し、削除で残りを返す", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cand-"));
    const path = join(dir, "candidates.yaml");
    await addCandidates(path, [cand("UCa"), cand("UCb")]);
    const afterDup = await addCandidates(path, [cand("UCa"), cand("UCc")]);
    expect(afterDup.map((candidate) => candidate.channelId).sort()).toEqual(["UCa", "UCb", "UCc"]);
    const afterRemove = await removeCandidate(path, "UCb");
    expect(afterRemove.map((candidate) => candidate.channelId).sort()).toEqual(["UCa", "UCc"]);
    expect(await readCandidates(path)).toHaveLength(2);
  });
});
