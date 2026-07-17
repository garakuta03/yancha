import { findDuplicates } from "../src/stages/uniquenessCheck.js";
import type { UniquenessData } from "../src/types/pipeline.js";

describe("findDuplicates", () => {
  test("完全一致する過去動画IDを返す", () => {
    expect(findDuplicates(base("current"), [base("past-1"), { ...base("past-2"), seed: "different" }])).toEqual(["past-1"]);
  });

  test("自分自身は一致しても除外する", () => {
    expect(findDuplicates(base("current"), [base("current")])).toEqual([]);
  });

  test("非一致は空配列を返す", () => {
    expect(
      findDuplicates(base("current"), [
        { ...base("past-1"), audioLayers: ["steady-rain"] },
        { ...base("past-2"), visualParams: { ...base("past-2").visualParams, brightness: 0.7 } }
      ])
    ).toEqual([]);
  });
});

function base(videoId: string): UniquenessData {
  return {
    videoId,
    seed: "seed-1",
    audioPreset: "rain",
    audioLayers: ["steady-rain", "soft-drops"],
    visualPreset: "particles",
    visualParams: {
      particleCount: 240,
      drift: 0.35,
      brightness: 0.55,
      loopSeconds: 10
    },
    createdAt: "2026-07-16T00:00:00.000Z"
  };
}
