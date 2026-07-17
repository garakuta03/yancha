import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { YanchaError, writeJson } from "@yancha/core";
import { createLlmClient, type LlmClient, type LlmGenerateRequest, type LlmGenerateResponse } from "../src/clients/llm.js";
import type { LicenseDocument } from "../src/license.js";
import { MetadataStage, validateMetadata } from "../src/stages/metadata.js";
import type { MetadataData, SceneData, StageArtifact } from "../src/types/pipeline.js";

describe("validateMetadata", () => {
  test("正しいmetadata.jsonを受け付ける", () => {
    expect(validateMetadata(validMetadata(), { requiredStoryline: storyline })).toMatchObject({
      title: "雨の夜にひらく静かなアンビエンス",
      description: expect.stringContaining(storyline),
      tags: ["雨音", "環境音"],
      thumbnailPrompt: "雨の窓辺と淡い粒子"
    });
  });

  test("欠損フィールドを弾く", () => {
    const metadata = validMetadata();
    const { title: _title, ...missingTitle } = metadata;
    expect(() => validateMetadata(missingTitle)).toThrow(YanchaError);
    expect(() => validateMetadata(missingTitle)).toThrow("metadata.jsonが不正");
  });

  test("型不一致を弾く", () => {
    expect(() => validateMetadata({ ...validMetadata(), tags: "雨音" })).toThrow(YanchaError);
    expect(() => validateMetadata({ ...validMetadata(), thumbnailPrompt: 42 })).toThrow(YanchaError);
  });

  test("descriptionにstorylineがない値を弾く", () => {
    expect(() => validateMetadata({ ...validMetadata(), description: "別の説明文です。" }, { requiredStoryline: storyline })).toThrow(
      "descriptionにはscene.jsonのstoryline"
    );
  });
});

describe("MetadataStage", () => {
  test("scene.jsonからmetadata.jsonとlicense.jsonを出力する", async () => {
    const videoDir = await mkdtemp(join(tmpdir(), "yancha-metadata-stage-"));
    const videoId = "metadata-stage-test";
    await writeJson(join(videoDir, "scene.json"), sceneArtifact(videoId));

    const stage = new MetadataStage(new FixedLlmClient());
    const artifact = await stage.run({ videoId, videoDir });

    expect(artifact.data.description).toContain(storyline);

    const metadata = JSON.parse(await readFile(join(videoDir, "metadata.json"), "utf8")) as StageArtifact<MetadataData>;
    const license = JSON.parse(await readFile(join(videoDir, "license.json"), "utf8")) as LicenseDocument;

    expect(metadata.stageId).toBe("metadata");
    expect(metadata.data).toMatchObject(validMetadata());
    expect(license.entries.map((entry) => entry.assetType)).toContain("metadata");
  });

  test("MockLlmClientのJSON応答でmetadataステージが動く", async () => {
    const videoDir = await mkdtemp(join(tmpdir(), "yancha-metadata-mock-"));
    const videoId = "metadata-mock-test";
    await writeJson(join(videoDir, "scene.json"), sceneArtifact(videoId));

    const mockClient = createLlmClient({
      logLevel: "error",
      assetsDir: "assets",
      llm: {
        provider: "mock",
        model: "local-mock",
        openaiBaseUrl: "",
        geminiBaseUrl: ""
      },
      comfyuiBaseUrl: "",
      ffmpegPath: "ffmpeg",
      youtube: {}
    });

    const artifact = await new MetadataStage(mockClient).run({ videoId, videoDir });

    expect(artifact.data.description).toContain(storyline);
    expect(artifact.data.tags.length).toBeGreaterThan(0);
  });
});

const storyline = "静かな夜の雨音と淡い粒子の動きを描きます。";

class FixedLlmClient implements LlmClient {
  async generate(_request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return { text: JSON.stringify(validMetadata()), provider: "test", model: "fixed" };
  }

  async generateJson<T>(_request: LlmGenerateRequest, validate: (value: unknown) => T): Promise<T> {
    return validate(validMetadata());
  }
}

function validMetadata(): MetadataData {
  return {
    title: "雨の夜にひらく静かなアンビエンス",
    description: `${storyline}\n\n雨音と淡い粒子の動きを中心にしたノーボイス環境動画です。`,
    tags: ["雨音", "環境音"],
    thumbnailPrompt: "雨の窓辺と淡い粒子"
  };
}

function sceneArtifact(videoId: string): StageArtifact<SceneData> {
  return {
    videoId,
    stageId: "scene",
    createdAt: "2026-07-16T00:00:00.000Z",
    data: {
      sceneId: "rain-night",
      title: "雨の夜",
      storyline,
      durationSeconds: 60,
      seed: "seed",
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
    }
  };
}
