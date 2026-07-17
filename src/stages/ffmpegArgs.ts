import { YanchaError } from "@yancha/core";

const loudnessTarget = -16;
const truePeakTarget = -1.5;
const lraTarget = 11;

export interface LoudnormMeasurement {
  readonly inputI: string;
  readonly inputTp: string;
  readonly inputLra: string;
  readonly inputThresh: string;
  readonly targetOffset: string;
}

export interface BuildMuxArgsOptions {
  readonly visualLoop: string;
  readonly audio: string;
  readonly output: string;
  readonly durationSeconds: number;
  readonly measured: LoudnormMeasurement;
}

export function buildLoudnormMeasureArgs(input: string): readonly string[] {
  return [
    "-hide_banner",
    "-nostdin",
    "-i",
    input,
    "-af",
    `loudnorm=I=${loudnessTarget}:TP=${truePeakTarget}:LRA=${lraTarget}:print_format=json`,
    "-f",
    "null",
    "-"
  ];
}

export function buildMuxArgs(opts: BuildMuxArgsOptions): readonly string[] {
  return [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    opts.visualLoop,
    "-i",
    opts.audio,
    "-t",
    String(opts.durationSeconds),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-af",
    // loudnormは内部で192k系へリサンプルする。明示しないとAACが96kHz等で焼かれ、
    // 一般プレーヤーがデコードできず無音になるため、末尾で48kHzへ揃える。
    `${buildLoudnormApplyFilter(opts.measured)},aresample=48000`,
    "-movflags",
    "+faststart",
    opts.output
  ];
}

export function parseLoudnormMeasurement(stderr: string): LoudnormMeasurement {
  const candidates = stderr.match(/\{[\s\S]*?\}/g) ?? [];
  for (const candidate of candidates.reverse()) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (isMeasurementLike(value)) {
        return {
          inputI: stringifyMeasurementValue(value.input_i),
          inputTp: stringifyMeasurementValue(value.input_tp),
          inputLra: stringifyMeasurementValue(value.input_lra),
          inputThresh: stringifyMeasurementValue(value.input_thresh),
          targetOffset: stringifyMeasurementValue(value.target_offset)
        };
      }
    } catch {
      // stderrにはffmpegの通常ログも混ざるため、JSON候補でない断片は読み飛ばす。
    }
  }
  throw new YanchaError("FFMPEG_ERROR", "loudnormの測定結果JSONをstderrから読み取れませんでした。");
}

function buildLoudnormApplyFilter(measured: LoudnormMeasurement): string {
  return [
    `loudnorm=I=${loudnessTarget}`,
    `TP=${truePeakTarget}`,
    `LRA=${lraTarget}`,
    `measured_I=${measured.inputI}`,
    `measured_TP=${measured.inputTp}`,
    `measured_LRA=${measured.inputLra}`,
    `measured_thresh=${measured.inputThresh}`,
    `offset=${measured.targetOffset}`,
    "linear=true",
    "print_format=summary"
  ].join(":");
}

function isMeasurementLike(value: unknown): value is {
  readonly input_i: unknown;
  readonly input_tp: unknown;
  readonly input_lra: unknown;
  readonly input_thresh: unknown;
  readonly target_offset: unknown;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    hasMeasurementValue(value, "input_i") &&
    hasMeasurementValue(value, "input_tp") &&
    hasMeasurementValue(value, "input_lra") &&
    hasMeasurementValue(value, "input_thresh") &&
    hasMeasurementValue(value, "target_offset")
  );
}

function hasMeasurementValue(value: object, key: string): boolean {
  if (!(key in value)) {
    return false;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" || typeof field === "number";
}

function stringifyMeasurementValue(value: string | number | unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  throw new YanchaError("FFMPEG_ERROR", "loudnormの測定値が不正です。");
}
