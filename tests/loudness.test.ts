import { YanchaError } from "@yancha/core";
import { buildEbur128MeasureArgs, isLoudnessInRange, parseEbur128IntegratedLufs } from "../src/stages/loudness.js";

describe("loudness", () => {
  test("ebur128測定引数を組み立てる", () => {
    expect(buildEbur128MeasureArgs("final.mp4")).toEqual([
      "-hide_banner",
      "-nostdin",
      "-i",
      "final.mp4",
      "-af",
      "ebur128=peak=true",
      "-f",
      "null",
      "-"
    ]);
  });

  test("ebur128 stderrからIntegrated loudnessをパースする", () => {
    const stderr = `
      [Parsed_ebur128_0 @ 0x123] Summary:

      Integrated loudness:
        I:         -18.7 LUFS
        Threshold: -28.7 LUFS
    `;

    expect(parseEbur128IntegratedLufs(stderr)).toBe(-18.7);
  });

  test("複数のIntegrated loudnessがある場合は最後の値を使う", () => {
    const stderr = `
      Integrated loudness:
        I: -70.0 LUFS
      Summary:
      Integrated loudness:
        I: -16.4 LUFS
    `;

    expect(parseEbur128IntegratedLufs(stderr)).toBe(-16.4);
  });

  test("測定値がないstderrはYanchaErrorにする", () => {
    expect(() => parseEbur128IntegratedLufs("ffmpeg failed")).toThrow(YanchaError);
  });

  test("LUFSの許容範囲は-20から-16までにする", () => {
    expect(isLoudnessInRange(-20)).toBe(true);
    expect(isLoudnessInRange(-18)).toBe(true);
    expect(isLoudnessInRange(-16)).toBe(true);
    expect(isLoudnessInRange(-20.1)).toBe(false);
    expect(isLoudnessInRange(-15.9)).toBe(false);
  });
});
