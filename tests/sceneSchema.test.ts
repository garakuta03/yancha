import { YanchaError } from "@yancha/core";
import { validateScene } from "../src/stages/sceneSchema.js";

describe("validateScene", () => {
  test("正しいscene.jsonを受け付ける", () => {
    expect(validateScene(validScene())).toMatchObject({
      sceneId: "rain-night",
      durationSeconds: 60,
      audio: { preset: "rain" },
      visual: { preset: "particles" }
    });
  });

  test("preset外の値を弾く", () => {
    expectInvalid({ audio: { preset: "ocean" } });
    expectInvalid({ visual: { preset: "forest" } });
  });

  test("数値レンジ外の値を弾く", () => {
    expectInvalid({ durationSeconds: 9 });
    expectInvalid({ durationSeconds: 3601 });
    expectInvalid({ audio: { layers: [{ id: "steady-rain", type: "rain", gain: 1.1 }] } });
    expectInvalid({ visual: { params: { particleCount: 0 } } });
    expectInvalid({ visual: { params: { drift: 2.1 } } });
    expectInvalid({ visual: { params: { brightness: -0.1 } } });
    expectInvalid({ visual: { params: { loopSeconds: 61 } } });
  });

  test("欠損フィールドを弾く", () => {
    const scene = validScene();
    const { title: _title, ...missingTitle } = scene;
    expect(() => validateScene(missingTitle)).toThrow(YanchaError);

    expectInvalid({ audio: { layers: [] } });
    const missingLoopSeconds = validScene();
    delete (missingLoopSeconds.visual.params as Partial<typeof missingLoopSeconds.visual.params>).loopSeconds;
    expect(() => validateScene(missingLoopSeconds)).toThrow(YanchaError);
  });
});

function expectInvalid(patch: Record<string, unknown>): void {
  expect(() => validateScene(deepMerge(validScene(), patch))).toThrow(YanchaError);
  expect(() => validateScene(deepMerge(validScene(), patch))).toThrow("scene.jsonが不正");
}

function validScene() {
  return {
    sceneId: "rain-night",
    title: "雨の夜",
    storyline: "静かな夜の雨音と淡い粒子の動きを描きます。",
    durationSeconds: 60,
    seed: "seed",
    audio: {
      preset: "rain",
      layers: [
        { id: "steady-rain", type: "rain", gain: 0.8 },
        { id: "soft-drops", type: "drops", gain: 0.35 }
      ]
    },
    visual: {
      preset: "particles",
      params: {
        particleCount: 240,
        drift: 0.35,
        brightness: 0.55,
        loopSeconds: 10
      }
    }
  };
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (isRecord(base) && isRecord(patch)) {
    return Object.fromEntries(
      [...new Set([...Object.keys(base), ...Object.keys(patch)])].map((key) => [key, deepMerge(base[key], patch[key])])
    );
  }
  return patch === undefined ? base : patch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
