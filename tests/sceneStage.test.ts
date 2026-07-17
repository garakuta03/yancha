import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveSeed, writeJson } from "@yancha/core";
import type { LlmClient, LlmGenerateRequest, LlmGenerateResponse } from "../src/clients/llm.js";
import { SceneStage } from "../src/stages/scene.js";
import type { LicenseDocument } from "../src/license.js";
import type { SceneData, StageArtifact, ThemeData, UniquenessData } from "../src/types/pipeline.js";

describe("SceneStage", () => {
  test("theme.jsonからscene.json、uniqueness.json、license.jsonを出力する", async () => {
    const videoDir = await mkdtemp(join(tmpdir(), "yancha-scene-stage-"));
    const videoId = "scene-stage-test";
    await writeJson(join(videoDir, "theme.json"), themeArtifact(videoId));

    const stage = new SceneStage(new FixedLlmClient());
    const artifact = await stage.run({ videoId, videoDir });
    const expectedSeed = deriveSeed(videoId, "scene");

    expect(artifact.data.seed).toBe(expectedSeed);
    expect(artifact.data.seed).not.toBe("llm-seed");

    const scene = JSON.parse(await readFile(join(videoDir, "scene.json"), "utf8")) as StageArtifact<SceneData>;
    const uniqueness = JSON.parse(await readFile(join(videoDir, "uniqueness.json"), "utf8")) as StageArtifact<UniquenessData>;
    const license = JSON.parse(await readFile(join(videoDir, "license.json"), "utf8")) as LicenseDocument;

    expect(scene.stageId).toBe("scene");
    expect(scene.data.seed).toBe(expectedSeed);
    expect(uniqueness.data).toMatchObject({
      videoId,
      seed: expectedSeed,
      audioPreset: "rain",
      audioLayers: ["steady-rain"],
      visualPreset: "particles"
    });
    expect(license.entries.map((entry) => entry.assetType)).toContain("scene");
  });
});

class FixedLlmClient implements LlmClient {
  async generate(_request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return { text: JSON.stringify(this.scene()), provider: "test", model: "fixed" };
  }

  async generateJson<T>(_request: LlmGenerateRequest, validate: (value: unknown) => T): Promise<T> {
    return validate(this.scene());
  }

  private scene(): unknown {
    return {
      sceneId: "rain-night",
      title: "雨の夜",
      storyline: "静かな夜の雨音と淡い粒子の動きを描きます。",
      durationSeconds: 60,
      audio: {
        preset: "rain",
        layers: [{ id: "steady-rain", type: "rain", gain: 0.8 }]
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
}

function themeArtifact(videoId: string): StageArtifact<ThemeData> {
  return {
    videoId,
    stageId: "theme",
    createdAt: "2026-07-16T00:00:00.000Z",
    data: {
      title: "雨の夜",
      keywords: ["雨音", "夜"],
      targetMinutes: 1,
      format: "ambience",
      audience: "静かな時間を過ごしたい人",
      tone: "穏やか"
    }
  };
}
