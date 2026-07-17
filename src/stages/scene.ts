import { join } from "node:path";
import { deriveSeed, readJson, writeJson } from "@yancha/core";
import type { LlmClient } from "../clients/llm.js";
import { appendLicenseEntry } from "../license.js";
import type { SceneData, StageArtifact, StageRunner, ThemeData, UniquenessData } from "../types/pipeline.js";
import { buildScenePrompt } from "./scenePrompt.js";
import { validateScene } from "./sceneSchema.js";

export class SceneStage implements StageRunner {
  readonly id = "scene" as const;
  readonly outputFile = "scene.json";

  constructor(private readonly llmClient: LlmClient) {}

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<SceneData>> {
    const createdAt = new Date().toISOString();
    const themeArtifact = await readJson<StageArtifact<ThemeData>>(join(context.videoDir, "theme.json"));
    const seed = deriveSeed(context.videoId, "scene");
    const generated = await this.llmClient.generateJson(
      {
        temperature: 0.2,
        responseFormat: "json",
        messages: [
          {
            role: "system",
            content: "あなたは睡眠/ヒーリング用ノーボイス環境動画のシーン設計者です。必ずJSONオブジェクトだけを返してください。"
          },
          { role: "user", content: buildScenePrompt(themeArtifact.data) }
        ]
      },
      (value) => validateScene({ ...(typeof value === "object" && value !== null ? value : {}), seed })
    );
    const scene: SceneData = generated;
    const artifact: StageArtifact<SceneData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt,
      data: scene
    };
    const uniqueness: StageArtifact<UniquenessData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt,
      data: {
        videoId: context.videoId,
        seed,
        audioPreset: scene.audio.preset,
        audioLayers: scene.audio.layers.map((layer) => layer.id),
        visualPreset: scene.visual.preset,
        visualParams: {
          particleCount: scene.visual.params.particleCount,
          drift: scene.visual.params.drift,
          brightness: scene.visual.params.brightness,
          loopSeconds: scene.visual.params.loopSeconds
        },
        createdAt
      }
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    await writeJson(join(context.videoDir, "uniqueness.json"), uniqueness);
    await appendLicenseEntry(context.videoDir, {
      assetType: "scene",
      tool: "yancha scene stage",
      provider: "llm",
      modelOrPlan: "generateJson + procedural preset schema",
      termsVersion: "p0-e2e-mvp-2026-07-16",
      createdAt,
      notes: "LLMはシーン本文とパラメータ選択のみ。seedはderiveSeed(videoId, \"scene\")で導出。"
    });

    return artifact;
  }
}
