import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { runFfmpeg, YanchaError } from "@yancha/core";
import { createRainRenderState, renderRainChunk, type AudioStats, type RainLayer } from "./rain.js";
import { DEFAULT_SAMPLE_RATE, encodeWavPcm16 } from "./wav.js";

export type AudioPreset = "rain";

export interface SynthesizeAmbientOptions {
  readonly preset: AudioPreset;
  readonly layers: readonly RainLayer[];
  readonly durationSeconds: number;
  readonly seed: string;
  readonly outPath: string;
  readonly chunkSeconds?: number;
  readonly ffmpegPath?: string;
}

export interface ChunkPlan {
  readonly index: number;
  readonly durationSeconds: number;
  readonly wavPath: string;
}

export function buildChunkPlan(outPath: string, durationSeconds: number, chunkSeconds: number): readonly ChunkPlan[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new YanchaError("ARTIFACT_INVALID", "durationSecondsは正の数値である必要があります。");
  }
  if (!Number.isFinite(chunkSeconds) || chunkSeconds <= 0) {
    throw new YanchaError("ARTIFACT_INVALID", "chunkSecondsは正の数値である必要があります。");
  }

  const chunkDir = chunkDirectory(outPath);
  const plan: ChunkPlan[] = [];
  let remaining = durationSeconds;
  let index = 0;
  while (remaining > 0) {
    const currentDuration = Math.min(chunkSeconds, remaining);
    plan.push({
      index,
      durationSeconds: currentDuration,
      wavPath: join(chunkDir, `chunk-${String(index).padStart(4, "0")}.wav`)
    });
    remaining -= currentDuration;
    index += 1;
  }
  return plan;
}

export function buildConcatArgs(listPath: string, outPath: string): readonly string[] {
  return ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath];
}

export async function synthesizeAmbient(options: SynthesizeAmbientOptions): Promise<void> {
  if (options.preset !== "rain") {
    throw new YanchaError("ARTIFACT_INVALID", `未対応の音声プリセットです: ${options.preset}`);
  }

  const chunkSeconds = options.chunkSeconds ?? 10;
  const plan = buildChunkPlan(options.outPath, options.durationSeconds, chunkSeconds);
  const chunkDir = chunkDirectory(options.outPath);
  await rm(chunkDir, { recursive: true, force: true });
  await mkdir(chunkDir, { recursive: true });
  await mkdir(dirname(options.outPath), { recursive: true });

  const state = createRainRenderState({
    layers: options.layers,
    durationSeconds: options.durationSeconds,
    seed: options.seed,
    sampleRate: DEFAULT_SAMPLE_RATE
  });
  let aggregatePeak = 0;
  let weightedSquares = 0;
  let aggregateSamples = 0;

  for (const chunk of plan) {
    const rendered = renderRainChunk(state, chunk.durationSeconds);
    await writeFile(chunk.wavPath, encodeWavPcm16(rendered.channels, DEFAULT_SAMPLE_RATE));
    aggregatePeak = Math.max(aggregatePeak, rendered.stats.peak);
    const samples = Math.round(chunk.durationSeconds * DEFAULT_SAMPLE_RATE) * 2;
    weightedSquares += rendered.stats.rms * rendered.stats.rms * samples;
    aggregateSamples += samples;
  }

  const stats: AudioStats = {
    peak: aggregatePeak,
    rms: aggregateSamples === 0 ? 0 : Math.sqrt(weightedSquares / aggregateSamples)
  };
  if (stats.peak >= 1) {
    throw new YanchaError("ARTIFACT_INVALID", `雨音合成でクリッピングを検出しました。peak=${stats.peak.toFixed(4)}`);
  }

  const listPath = join(chunkDir, "concat.txt");
  await writeFile(listPath, buildConcatFile(plan), "utf8");
  await runFfmpeg(buildConcatArgs(listPath, options.outPath), {
    ...(options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {})
  });
}

function buildConcatFile(plan: readonly ChunkPlan[]): string {
  return plan.map((chunk) => `file '${escapeConcatPath(resolve(chunk.wavPath))}'`).join("\n") + "\n";
}

function escapeConcatPath(path: string): string {
  return path.replaceAll("'", "'\\''");
}

function chunkDirectory(outPath: string): string {
  return `${outPath}.chunks`;
}

export { renderRain, renderRainWavBuffer, analyzeChannels, assertNoClipping } from "./rain.js";
export type { AudioStats, RainLayer, RainRenderOptions } from "./rain.js";
export { createWhiteNoise, onePoleHighPass, onePoleLowPass } from "./dsp.js";
export { encodeWavPcm16, DEFAULT_SAMPLE_RATE } from "./wav.js";
