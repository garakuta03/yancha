import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readJson, writeJson } from "@yancha/core";
import { appendLicenseEntry } from "../license.js";
import type { SceneData, StageArtifact, StageRunner } from "../types/pipeline.js";
import { synthesizeAmbient } from "../../packages/audio-synth/src/index.js";

interface AudioStageData {
  readonly preset: "rain";
  readonly outputFile: "ambient.wav";
  readonly durationSeconds: number;
  readonly seed: string;
  readonly layerIds: readonly string[];
}

export class AudioStage implements StageRunner {
  readonly id = "audio" as const;
  readonly outputFile = "audio.meta.json";

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<AudioStageData>> {
    const sceneArtifact = await readJson<StageArtifact<SceneData>>(join(context.videoDir, "scene.json"));
    const scene = sceneArtifact.data;
    const outPath = join(context.videoDir, "ambient.wav");

    await synthesizeAmbient({
      preset: scene.audio.preset,
      layers: scene.audio.layers,
      durationSeconds: scene.durationSeconds,
      seed: scene.seed,
      outPath
    });

    const artifact: StageArtifact<AudioStageData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: sceneArtifact.createdAt,
      data: {
        preset: scene.audio.preset,
        outputFile: "ambient.wav",
        durationSeconds: scene.durationSeconds,
        seed: scene.seed,
        layerIds: scene.audio.layers.map((layer) => layer.id)
      }
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    await mkdir(join(context.videoDir, "logs"), { recursive: true });
    await writeFile(
      join(context.videoDir, "logs", "audio.json"),
      `${JSON.stringify(
        {
          videoId: context.videoId,
          preset: scene.audio.preset,
          durationSeconds: scene.durationSeconds,
          seed: scene.seed,
          layers: scene.audio.layers
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await appendLicenseEntry(context.videoDir, {
      assetType: "ambient",
      tool: "@yancha/audio-synth",
      provider: "yancha",
      modelOrPlan: "procedural rain noise + one-pole filters",
      termsVersion: "p0-e2e-mvp-2026-07-16",
      createdAt: sceneArtifact.createdAt,
      notes: "scene.jsonのrainレイヤーとseedから依存ゼロTypeScript実装で生成。"
    });

    return artifact;
  }
}
