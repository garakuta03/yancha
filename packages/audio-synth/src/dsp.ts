import { YanchaError } from "@yancha/core";

export interface FilterState {
  readonly previousInput: number;
  readonly previousOutput: number;
}

export interface FilterResult {
  readonly samples: Float32Array;
  readonly state: FilterState;
}

export const EMPTY_FILTER_STATE: FilterState = {
  previousInput: 0,
  previousOutput: 0
};

export function createWhiteNoise(length: number, rng: () => number, gain = 1): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (rng() * 2 - 1) * gain;
  }
  return samples;
}

export function onePoleLowPass(
  input: Float32Array,
  cutoffHz: number,
  sampleRate: number,
  initialState: FilterState = EMPTY_FILTER_STATE
): FilterResult {
  const alpha = lowPassAlpha(cutoffHz, sampleRate);
  const samples = new Float32Array(input.length);
  let previousOutput = initialState.previousOutput;

  for (let index = 0; index < input.length; index += 1) {
    previousOutput += alpha * (input[index]! - previousOutput);
    samples[index] = previousOutput;
  }

  return {
    samples,
    state: {
      previousInput: input.length > 0 ? input[input.length - 1]! : initialState.previousInput,
      previousOutput
    }
  };
}

export function onePoleHighPass(
  input: Float32Array,
  cutoffHz: number,
  sampleRate: number,
  initialState: FilterState = EMPTY_FILTER_STATE
): FilterResult {
  const alpha = highPassAlpha(cutoffHz, sampleRate);
  const samples = new Float32Array(input.length);
  let previousInput = initialState.previousInput;
  let previousOutput = initialState.previousOutput;

  for (let index = 0; index < input.length; index += 1) {
    const currentInput = input[index]!;
    const currentOutput = alpha * (previousOutput + currentInput - previousInput);
    samples[index] = currentOutput;
    previousInput = currentInput;
    previousOutput = currentOutput;
  }

  return {
    samples,
    state: {
      previousInput,
      previousOutput
    }
  };
}

function lowPassAlpha(cutoffHz: number, sampleRate: number): number {
  assertPositive(cutoffHz, "cutoffHz");
  assertPositive(sampleRate, "sampleRate");
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  return dt / (rc + dt);
}

function highPassAlpha(cutoffHz: number, sampleRate: number): number {
  assertPositive(cutoffHz, "cutoffHz");
  assertPositive(sampleRate, "sampleRate");
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  return rc / (rc + dt);
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new YanchaError("ARTIFACT_INVALID", `${name}は正の数値である必要があります。`);
  }
}
