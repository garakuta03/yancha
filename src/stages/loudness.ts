import { runFfmpeg, YanchaError } from "@yancha/core";

export const loudnessMinLufs = -20;
export const loudnessMaxLufs = -16;

export interface LoudnessCheckMeasurement {
  readonly integratedLufs: number;
}

export function buildEbur128MeasureArgs(input: string): readonly string[] {
  return ["-hide_banner", "-nostdin", "-i", input, "-af", "ebur128=peak=true", "-f", "null", "-"];
}

export async function measureIntegratedLoudness(input: string): Promise<LoudnessCheckMeasurement> {
  const result = await runFfmpeg(buildEbur128MeasureArgs(input));
  return { integratedLufs: parseEbur128IntegratedLufs(result.stderr) };
}

export function parseEbur128IntegratedLufs(stderr: string): number {
  const matches = [...stderr.matchAll(/Integrated loudness:\s*[\s\S]*?\bI:\s*([+-]?\d+(?:\.\d+)?)\s*LUFS/gu)];
  const last = matches.at(-1);
  const value = last?.[1];
  if (!value) {
    throw new YanchaError("FFMPEG_ERROR", "ebur128のIntegrated loudnessをstderrから読み取れませんでした。");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new YanchaError("FFMPEG_ERROR", "ebur128のIntegrated loudnessが数値ではありません。");
  }
  return parsed;
}

export function isLoudnessInRange(lufs: number): boolean {
  return lufs >= loudnessMinLufs && lufs <= loudnessMaxLufs;
}
