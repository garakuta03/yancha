import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { YanchaError, runFfmpeg } from "@yancha/core";
import type { Browser } from "puppeteer";
import { launchRenderBrowser } from "./browser.js";
import { startSceneServer } from "./server.js";

export type VisualPreset = "particles";

export interface VisualParams {
  readonly particleCount: number;
  readonly drift: number;
  readonly brightness: number;
  readonly loopSeconds: number;
}

export interface RenderLoopOptions {
  readonly preset: VisualPreset;
  readonly params: VisualParams;
  readonly loopSeconds: number;
  readonly seed: string;
  readonly outPath: string;
  readonly frameRate?: number;
  readonly width?: number;
  readonly height?: number;
  readonly ffmpegPath?: string;
  readonly executablePath?: string | undefined;
}

export interface SignalStatsSummary {
  readonly frameCount: number;
  readonly minYavg: number;
  readonly maxYavg: number;
  readonly maxYdif: number;
}

interface RenderSceneOptions {
  readonly params: VisualParams;
  readonly loopSeconds: number;
  readonly seed: string;
  readonly frameRate: number;
  readonly frameCount: number;
  readonly width: number;
  readonly height: number;
}

interface BrowserRenderGlobal {
  __initScene(options: RenderSceneOptions): void;
  __renderFrame(frameIndex: number): void;
}

export const DEFAULT_FRAME_RATE = 30;
export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;
export const MIN_YAVG = 5;
export const MAX_YAVG = 225;

export async function renderLoop(opts: RenderLoopOptions): Promise<void> {
  if (opts.preset !== "particles") {
    throw new YanchaError("CONFIG_INVALID", "visual presetはparticlesのみ対応しています。");
  }

  const frameRate = opts.frameRate ?? DEFAULT_FRAME_RATE;
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const frameCount = computeFrameCount(opts.loopSeconds, frameRate);
  const tempDir = await mkdtemp(join(tmpdir(), "yancha-visual-"));
  const framesDir = join(tempDir, "frames");
  const statsPath = join(tempDir, "signalstats.txt");

  await mkdir(framesDir, { recursive: true });
  await mkdir(dirname(opts.outPath), { recursive: true });

  const server = await startSceneServer();
  let browser: Browser | undefined;
  try {
    browser = await launchRenderBrowser({ executablePath: opts.executablePath });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`${server.origin}/particles/index.html`, { waitUntil: "networkidle0" });
    await page.evaluate(
      (options) => {
        const renderGlobal = globalThis as typeof globalThis & BrowserRenderGlobal;
        renderGlobal.__initScene(options);
      },
      {
        params: opts.params,
        loopSeconds: opts.loopSeconds,
        seed: opts.seed,
        frameRate,
        frameCount,
        width,
        height
      }
    );

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      await page.evaluate((index) => {
        const renderGlobal = globalThis as typeof globalThis & BrowserRenderGlobal;
        renderGlobal.__renderFrame(index);
      }, frameIndex);
      await page.screenshot({
        path: framePath(framesDir, frameIndex),
        optimizeForSpeed: true
      });
    }

    const pattern = join(framesDir, "frame-%04d.png");
    await assertRenderedFrames({
      pattern,
      framesDir,
      statsPath,
      frameRate,
      ffmpegPath: opts.ffmpegPath
    });
    await runFfmpeg(buildEncodeLoopArgs({ pattern, outPath: opts.outPath, frameRate }), ffmpegOptions(opts.ffmpegPath));
  } finally {
    await browser?.close();
    await server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function computeFrameCount(loopSeconds: number, frameRate = DEFAULT_FRAME_RATE): number {
  if (!Number.isFinite(loopSeconds) || loopSeconds <= 0) {
    throw new YanchaError("CONFIG_INVALID", "loopSecondsは正の数値である必要があります。");
  }
  if (!Number.isInteger(frameRate) || frameRate <= 0) {
    throw new YanchaError("CONFIG_INVALID", "frameRateは正の整数である必要があります。");
  }
  return Math.max(2, Math.round(loopSeconds * frameRate));
}

export function buildSignalstatsArgs(opts: {
  readonly pattern: string;
  readonly statsPath: string;
  readonly frameRate?: number;
}): readonly string[] {
  return [
    "-hide_banner",
    "-nostdin",
    "-framerate",
    String(opts.frameRate ?? DEFAULT_FRAME_RATE),
    "-i",
    opts.pattern,
    "-vf",
    `signalstats,metadata=print:file=${opts.statsPath}`,
    "-f",
    "null",
    "-"
  ];
}

export function buildEncodeLoopArgs(opts: {
  readonly pattern: string;
  readonly outPath: string;
  readonly frameRate?: number;
}): readonly string[] {
  return [
    "-y",
    "-hide_banner",
    "-nostdin",
    "-framerate",
    String(opts.frameRate ?? DEFAULT_FRAME_RATE),
    "-i",
    opts.pattern,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    opts.outPath
  ];
}

export function parseSignalstats(text: string): SignalStatsSummary {
  const yavgValues = [...text.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/g)].map((match) =>
    Number(expectMatchValue(match[1], "YAVG"))
  );
  const ydifValues = [...text.matchAll(/lavfi\.signalstats\.YDIF=([0-9.]+)/g)].map((match) =>
    Number(expectMatchValue(match[1], "YDIF"))
  );
  const validYavg = yavgValues.filter((value) => Number.isFinite(value));
  const validYdif = ydifValues.filter((value) => Number.isFinite(value));

  if (validYavg.length === 0) {
    throw new YanchaError("ARTIFACT_INVALID", "signalstatsのYAVGを取得できませんでした。");
  }

  return {
    frameCount: validYavg.length,
    minYavg: Math.min(...validYavg),
    maxYavg: Math.max(...validYavg),
    maxYdif: validYdif.length > 0 ? Math.max(...validYdif) : 0
  };
}

export function assertSignalstats(summary: SignalStatsSummary): void {
  if (summary.minYavg < MIN_YAVG || summary.maxYavg > MAX_YAVG) {
    throw new YanchaError(
      "ARTIFACT_INVALID",
      `映像の輝度が異常です。YAVG=${summary.minYavg.toFixed(2)}-${summary.maxYavg.toFixed(2)}`
    );
  }
  if (summary.frameCount > 1 && summary.maxYdif <= 0) {
    throw new YanchaError("ARTIFACT_INVALID", "全フレームの差分がゼロです。白画面または静止画の可能性があります。");
  }
}

async function assertRenderedFrames(opts: {
  readonly pattern: string;
  readonly framesDir: string;
  readonly statsPath: string;
  readonly frameRate: number;
  readonly ffmpegPath: string | undefined;
}): Promise<void> {
  await runFfmpeg(buildSignalstatsArgs(opts), ffmpegOptions(opts.ffmpegPath));
  const summary = parseSignalstats(await readFile(opts.statsPath, "utf8"));
  assertSignalstats(summary);
  if (await allFrameFilesAreIdentical(opts.framesDir)) {
    throw new YanchaError("ARTIFACT_INVALID", "全フレームがバイト一致しています。SwiftShader設定不備の可能性があります。");
  }
}

async function allFrameFilesAreIdentical(framesDir: string): Promise<boolean> {
  const names = (await readdir(framesDir)).filter((name) => name.endsWith(".png")).sort();
  if (names.length <= 1) {
    return false;
  }

  let firstHash: string | undefined;
  for (const name of names) {
    const path = join(framesDir, name);
    const info = await stat(path);
    if (info.size === 0) {
      throw new YanchaError("ARTIFACT_INVALID", `${name}が空ファイルです。`);
    }
    const hash = createHash("sha256").update(await readFile(path)).digest("hex");
    firstHash ??= hash;
    if (hash !== firstHash) {
      return false;
    }
  }
  return true;
}

function ffmpegOptions(ffmpegPath: string | undefined): { readonly ffmpegPath?: string } {
  return ffmpegPath ? { ffmpegPath } : {};
}

function expectMatchValue(value: string | undefined, name: string): string {
  if (value !== undefined) {
    return value;
  }
  throw new YanchaError("ARTIFACT_INVALID", `signalstatsの${name}を解析できませんでした。`);
}

function framePath(framesDir: string, frameIndex: number): string {
  return join(framesDir, `frame-${String(frameIndex).padStart(4, "0")}.png`);
}
