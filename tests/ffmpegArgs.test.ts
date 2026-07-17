import { YanchaError } from "@yancha/core";
import { buildLoudnormMeasureArgs, buildMuxArgs, parseLoudnormMeasurement } from "../src/stages/ffmpegArgs.js";

describe("ffmpegArgs", () => {
  test("loudnorm 1パス目の測定引数を組み立てる", () => {
    const args = buildLoudnormMeasureArgs("ambient.wav");

    expect(args).toEqual([
      "-hide_banner",
      "-nostdin",
      "-i",
      "ambient.wav",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
      "-f",
      "null",
      "-"
    ]);
  });

  test("2パス目の合成引数に-stream_loopと-tと測定値適用が入る", () => {
    const args = buildMuxArgs({
      visualLoop: "visual-loop.mp4",
      audio: "ambient.wav",
      output: "final.mp4",
      durationSeconds: 60,
      measured: {
        inputI: "-24.10",
        inputTp: "-3.20",
        inputLra: "1.40",
        inputThresh: "-34.50",
        targetOffset: "0.25"
      }
    });

    expect(args.slice(args.indexOf("-stream_loop"), args.indexOf("-stream_loop") + 5)).toEqual([
      "-stream_loop",
      "-1",
      "-i",
      "visual-loop.mp4",
      "-i"
    ]);
    expect(args).toContain("-t");
    expect(args[args.indexOf("-t") + 1]).toBe("60");
    expect(args).toContain("ambient.wav");
    expect(args).toContain("final.mp4");
    expect(args[args.indexOf("-af") + 1]).toBe(
      "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-24.10:measured_TP=-3.20:measured_LRA=1.40:measured_thresh=-34.50:offset=0.25:linear=true:print_format=summary"
    );
  });

  test("ffmpeg stderrからloudnorm測定JSONをパースする", () => {
    const stderr = `
      [Parsed_loudnorm_0 @ 0x123] 
      {
        "input_i" : "-24.10",
        "input_tp" : "-3.20",
        "input_lra" : "1.40",
        "input_thresh" : "-34.50",
        "output_i" : "-16.01",
        "target_offset" : "0.25"
      }
    `;

    expect(parseLoudnormMeasurement(stderr)).toEqual({
      inputI: "-24.10",
      inputTp: "-3.20",
      inputLra: "1.40",
      inputThresh: "-34.50",
      targetOffset: "0.25"
    });
  });

  test("測定JSONがないstderrはYanchaErrorにする", () => {
    expect(() => parseLoudnormMeasurement("ffmpeg failed")).toThrow(YanchaError);
  });
});
