import { YanchaError } from "@yancha/core";
import type { AudioLayer, SceneData, VisualParams } from "../types/pipeline.js";

export function validateScene(value: unknown): SceneData {
  const root = expectRecord(value, "scene");
  const sceneId = expectNonEmptyString(root.sceneId, "sceneId");
  const title = expectNonEmptyString(root.title, "title");
  const storyline = expectNonEmptyString(root.storyline, "storyline");
  const durationSeconds = expectNumberInRange(root.durationSeconds, "durationSeconds", 10, 3600);
  const seed = expectNonEmptyString(root.seed, "seed");
  const audio = validateAudio(root.audio);
  const visual = validateVisual(root.visual);

  return {
    sceneId,
    title,
    storyline,
    durationSeconds,
    seed,
    audio,
    visual
  };
}

function validateAudio(value: unknown): SceneData["audio"] {
  const audio = expectRecord(value, "audio");
  const preset = expectLiteral(audio.preset, "audio.preset", ["rain"] as const);
  if (!Array.isArray(audio.layers) || audio.layers.length === 0) {
    throw invalid("audio.layersは1件以上の配列である必要があります。");
  }

  return {
    preset,
    layers: audio.layers.map((layer, index) => validateAudioLayer(layer, index))
  };
}

function validateAudioLayer(value: unknown, index: number): AudioLayer {
  const layer = expectRecord(value, `audio.layers[${index}]`);
  return {
    id: expectNonEmptyString(layer.id, `audio.layers[${index}].id`),
    type: expectLiteral(layer.type, `audio.layers[${index}].type`, ["rain", "drops"] as const),
    gain: expectNumberInRange(layer.gain, `audio.layers[${index}].gain`, 0, 1)
  };
}

function validateVisual(value: unknown): SceneData["visual"] {
  const visual = expectRecord(value, "visual");
  return {
    preset: expectLiteral(visual.preset, "visual.preset", ["particles"] as const),
    params: validateVisualParams(visual.params)
  };
}

function validateVisualParams(value: unknown): VisualParams {
  const params = expectRecord(value, "visual.params");
  return {
    particleCount: expectIntegerInRange(params.particleCount, "visual.params.particleCount", 1, 5000),
    drift: expectNumberInRange(params.drift, "visual.params.drift", 0, 2),
    brightness: expectNumberInRange(params.brightness, "visual.params.brightness", 0, 1),
    loopSeconds: expectNumberInRange(params.loopSeconds, "visual.params.loopSeconds", 1, 60)
  };
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw invalid(`${path}はオブジェクトである必要があります。`);
}

function expectNonEmptyString(value: unknown, path: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  throw invalid(`${path}は空でない文字列である必要があります。`);
}

function expectLiteral<const T extends readonly string[]>(value: unknown, path: string, allowed: T): T[number] {
  if (typeof value === "string" && allowed.includes(value)) {
    return value;
  }
  throw invalid(`${path}は${allowed.join(", ")}のいずれかである必要があります。`);
}

function expectNumberInRange(value: unknown, path: string, min: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max) {
    return value;
  }
  throw invalid(`${path}は${min}以上${max}以下の数値である必要があります。`);
}

function expectIntegerInRange(value: unknown, path: string, min: number, max: number): number {
  if (Number.isInteger(value) && typeof value === "number" && value >= min && value <= max) {
    return value;
  }
  throw invalid(`${path}は${min}以上${max}以下の整数である必要があります。`);
}

function invalid(message: string): YanchaError {
  return new YanchaError("ARTIFACT_INVALID", `scene.jsonが不正です。${message}`);
}
