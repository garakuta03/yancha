import { YanchaError } from "@yancha/core";
import { SWIFTSHADER_CHROME_ARGS } from "../src/browser.js";
import {
  assertSignalstats,
  buildEncodeLoopArgs,
  buildSignalstatsArgs,
  computeFrameCount,
  parseSignalstats
} from "../src/index.js";

describe("visual-synthの引数と検査", () => {
  it("SwiftShaderフラグを正確に固定する", () => {
    expect(SWIFTSHADER_CHROME_ARGS).toEqual([
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader-webgl",
      "--enable-unsafe-swiftshader"
    ]);
  });

  it("signalstats用ffmpeg引数を組み立てる", () => {
    expect(buildSignalstatsArgs({ pattern: "frames/frame-%04d.png", statsPath: "stats.txt", frameRate: 30 })).toEqual([
      "-hide_banner",
      "-nostdin",
      "-framerate",
      "30",
      "-i",
      "frames/frame-%04d.png",
      "-vf",
      "signalstats,metadata=print:file=stats.txt",
      "-f",
      "null",
      "-"
    ]);
  });

  it("連番PNGからループ素材mp4を作る引数を組み立てる", () => {
    expect(buildEncodeLoopArgs({ pattern: "frames/frame-%04d.png", outPath: "visual-loop.mp4", frameRate: 30 })).toEqual([
      "-y",
      "-hide_banner",
      "-nostdin",
      "-framerate",
      "30",
      "-i",
      "frames/frame-%04d.png",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "visual-loop.mp4"
    ]);
  });

  it("loopSecondsからフレーム数を決める", () => {
    expect(computeFrameCount(10, 30)).toBe(300);
    expect(computeFrameCount(0.01, 30)).toBe(2);
  });

  it("signalstatsを解析して正常な差分を通す", () => {
    const summary = parseSignalstats(`
      lavfi.signalstats.YAVG=42.5
      lavfi.signalstats.YDIF=0
      lavfi.signalstats.YAVG=43.0
      lavfi.signalstats.YDIF=1.25
    `);
    expect(summary).toEqual({ frameCount: 2, minYavg: 42.5, maxYavg: 43, maxYdif: 1.25 });
    expect(() => assertSignalstats(summary)).not.toThrow();
  });

  it("白画面相当の輝度を落とす", () => {
    expect(() => assertSignalstats({ frameCount: 2, minYavg: 234.97, maxYavg: 234.97, maxYdif: 1 })).toThrow(
      YanchaError
    );
  });

  it("全フレーム差分ゼロを落とす", () => {
    expect(() => assertSignalstats({ frameCount: 2, minYavg: 40, maxYavg: 40, maxYdif: 0 })).toThrow(YanchaError);
  });
});
