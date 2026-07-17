import { YanchaError } from "@yancha/core";
import { buildChunkPlan, buildConcatArgs, renderRainWavBuffer, assertNoClipping } from "../src/index.js";

const layers = [
  { id: "bed", type: "rain" as const, gain: 0.45 },
  { id: "drops", type: "drops" as const, gain: 0.2 }
];

describe("rain", () => {
  it("同一seedならWAVがバイト一致する", () => {
    const a = renderRainWavBuffer({ layers, durationSeconds: 0.25, seed: "seed-a" });
    const b = renderRainWavBuffer({ layers, durationSeconds: 0.25, seed: "seed-a" });

    expect(Buffer.compare(a, b)).toBe(0);
  });

  it("異なるseedならWAVが別物になる", () => {
    const a = renderRainWavBuffer({ layers, durationSeconds: 0.25, seed: "seed-a" });
    const b = renderRainWavBuffer({ layers, durationSeconds: 0.25, seed: "seed-b" });

    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it("peakが1.0に達したらクリッピングとして落とす", () => {
    expect(() => assertNoClipping({ peak: 1, rms: 0.2 })).toThrow(YanchaError);
  });

  it("チャンク計画とffmpeg concat引数を純関数で組み立てる", () => {
    const plan = buildChunkPlan("/tmp/ambient.wav", 25, 10);

    expect(plan.map((chunk) => chunk.durationSeconds)).toEqual([10, 10, 5]);
    expect(buildConcatArgs("/tmp/list.txt", "/tmp/ambient.wav")).toEqual([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "/tmp/list.txt",
      "-c",
      "copy",
      "/tmp/ambient.wav"
    ]);
  });
});
