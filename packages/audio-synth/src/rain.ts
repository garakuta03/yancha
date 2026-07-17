import { createRng, YanchaError } from "@yancha/core";
import {
  createWhiteNoise,
  EMPTY_FILTER_STATE,
  onePoleHighPass,
  onePoleLowPass,
  type FilterState
} from "./dsp.js";
import { DEFAULT_SAMPLE_RATE, encodeWavPcm16 } from "./wav.js";

export interface RainLayer {
  readonly id: string;
  readonly type: "rain" | "drops";
  readonly gain: number;
  readonly lowPassHz?: number;
  readonly highPassHz?: number;
  readonly pan?: number;
  readonly density?: number;
}

export interface RainRenderOptions {
  readonly layers: readonly RainLayer[];
  readonly durationSeconds: number;
  readonly seed: string;
  readonly sampleRate?: number;
}

export interface AudioStats {
  readonly peak: number;
  readonly rms: number;
}

interface LayerRuntime {
  readonly layer: NormalizedRainLayer;
  readonly rng: () => number;
  lowPassState: FilterState;
  highPassState: FilterState;
}

interface NormalizedRainLayer {
  readonly id: string;
  readonly type: "rain" | "drops";
  readonly gain: number;
  readonly lowPassHz: number;
  readonly highPassHz: number;
  readonly pan: number;
  readonly density: number;
}

export interface RainRenderState {
  readonly sampleRate: number;
  readonly layers: readonly LayerRuntime[];
}

export interface RenderedChunk {
  readonly channels: readonly [Float32Array, Float32Array];
  readonly stats: AudioStats;
}

export function createRainRenderState(options: RainRenderOptions): RainRenderState {
  assertRainOptions(options);
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  return {
    sampleRate,
    layers: options.layers.map((layer) => {
      const normalized = normalizeLayer(layer, options.seed);
      return {
        layer: normalized,
        rng: createRng(`${options.seed}:audio:${normalized.id}`),
        lowPassState: EMPTY_FILTER_STATE,
        highPassState: EMPTY_FILTER_STATE
      };
    })
  };
}

export function renderRainChunk(state: RainRenderState, durationSeconds: number): RenderedChunk {
  const sampleCount = Math.round(durationSeconds * state.sampleRate);
  const left = new Float32Array(sampleCount);
  const right = new Float32Array(sampleCount);

  for (const runtime of state.layers) {
    const source =
      runtime.layer.type === "drops"
        ? createDropNoise(sampleCount, runtime.rng, runtime.layer.density)
        : createWhiteNoise(sampleCount, runtime.rng, 1);
    const low = onePoleLowPass(source, runtime.layer.lowPassHz, state.sampleRate, runtime.lowPassState);
    const high = onePoleHighPass(low.samples, runtime.layer.highPassHz, state.sampleRate, runtime.highPassState);
    runtime.lowPassState = low.state;
    runtime.highPassState = high.state;

    const leftGain = runtime.layer.gain * (runtime.layer.pan <= 0 ? 1 : 1 - runtime.layer.pan);
    const rightGain = runtime.layer.gain * (runtime.layer.pan >= 0 ? 1 : 1 + runtime.layer.pan);
    for (let index = 0; index < sampleCount; index += 1) {
      left[index] = left[index]! + high.samples[index]! * leftGain;
      right[index] = right[index]! + high.samples[index]! * rightGain;
    }
  }

  const channels: readonly [Float32Array, Float32Array] = [left, right];
  const stats = analyzeChannels(channels);
  assertNoClipping(stats);
  return { channels, stats };
}

export function renderRain(options: RainRenderOptions): RenderedChunk {
  const state = createRainRenderState(options);
  return renderRainChunk(state, options.durationSeconds);
}

export function renderRainWavBuffer(options: RainRenderOptions): Buffer {
  const rendered = renderRain(options);
  return encodeWavPcm16(rendered.channels, options.sampleRate ?? DEFAULT_SAMPLE_RATE);
}

export function analyzeChannels(channels: readonly Float32Array[]): AudioStats {
  let peak = 0;
  let sumSquares = 0;
  let sampleCount = 0;

  for (const channel of channels) {
    for (const sample of channel) {
      const absolute = Math.abs(sample);
      if (absolute > peak) {
        peak = absolute;
      }
      sumSquares += sample * sample;
      sampleCount += 1;
    }
  }

  return {
    peak,
    rms: sampleCount === 0 ? 0 : Math.sqrt(sumSquares / sampleCount)
  };
}

export function assertNoClipping(stats: AudioStats): void {
  if (stats.peak >= 1) {
    throw new YanchaError("ARTIFACT_INVALID", `雨音合成でクリッピングを検出しました。peak=${stats.peak.toFixed(4)}`);
  }
}

function createDropNoise(sampleCount: number, rng: () => number, density: number): Float32Array {
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    if (rng() < density) {
      samples[index] = (rng() * 2 - 1) * (0.35 + rng() * 0.65);
    }
  }
  return samples;
}

function normalizeLayer(layer: RainLayer, seed: string): NormalizedRainLayer {
  const defaults = layer.type === "drops" ? dropDefaults : rainDefaults;
  const pan = layer.pan ?? (createRng(`${seed}:pan:${layer.id}`)() * 2 - 1) * defaults.panRange;
  return {
    id: layer.id,
    type: layer.type,
    gain: layer.gain * defaults.gainScale,
    lowPassHz: layer.lowPassHz ?? defaults.lowPassHz,
    highPassHz: layer.highPassHz ?? defaults.highPassHz,
    pan,
    density: layer.density ?? defaults.density
  };
}

const rainDefaults = {
  gainScale: 0.26,
  lowPassHz: 8_500,
  highPassHz: 70,
  density: 1,
  panRange: 0.15
};

const dropDefaults = {
  gainScale: 0.2,
  lowPassHz: 3_200,
  highPassHz: 420,
  density: 0.018,
  panRange: 0.65
};

function assertRainOptions(options: RainRenderOptions): void {
  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
    throw new YanchaError("ARTIFACT_INVALID", "durationSecondsは正の数値である必要があります。");
  }
  if (options.layers.length === 0) {
    throw new YanchaError("ARTIFACT_INVALID", "雨音レイヤーは1件以上必要です。");
  }
  for (const layer of options.layers) {
    if (!layer.id || layer.gain < 0 || layer.gain > 1) {
      throw new YanchaError("ARTIFACT_INVALID", `雨音レイヤーが不正です: ${layer.id || "id未設定"}`);
    }
  }
}
