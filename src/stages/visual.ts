import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deriveSeed, readJson, writeJson } from "@yancha/core";
import { appendLicenseEntry } from "../license.js";
import type { SceneData, StageArtifact, StageRunner } from "../types/pipeline.js";
import { renderLoop } from "../../packages/visual-synth/src/index.js";

interface VisualStageData {
  readonly preset: "particles";
  readonly outputFile: "visual-loop.mp4";
  readonly loopSeconds: number;
  readonly seed: string;
  readonly params: SceneData["visual"]["params"];
}

export class VisualStage implements StageRunner {
  readonly id = "visual" as const;
  readonly outputFile = "visual.meta.json";

  constructor(private readonly executablePath?: string) {}

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<VisualStageData>> {
    const sceneArtifact = await readJson<StageArtifact<SceneData>>(join(context.videoDir, "scene.json"));
    const scene = sceneArtifact.data;
    const outPath = join(context.videoDir, "visual-loop.mp4");
    const visualSeed = deriveSeed(context.videoId, "visual");
    const loopSeconds = scene.visual.params.loopSeconds;

    await renderLoop({
      preset: scene.visual.preset,
      params: scene.visual.params,
      loopSeconds,
      seed: visualSeed,
      outPath,
      executablePath: this.executablePath
    });

    const artifact: StageArtifact<VisualStageData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: sceneArtifact.createdAt,
      data: {
        preset: scene.visual.preset,
        outputFile: "visual-loop.mp4",
        loopSeconds,
        seed: visualSeed,
        params: scene.visual.params
      }
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    await mkdir(join(context.videoDir, "logs"), { recursive: true });
    await writeFile(
      join(context.videoDir, "logs", "visual.json"),
      `${JSON.stringify(
        {
          videoId: context.videoId,
          preset: scene.visual.preset,
          loopSeconds,
          seed: visualSeed,
          params: scene.visual.params,
          outputFile: "visual-loop.mp4"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await appendLicenseEntry(context.videoDir, {
      assetType: "visual",
      tool: "@yancha/visual-synth",
      provider: "yancha",
      modelOrPlan: "procedural particles + gradient rendered with three.js and SwiftShader",
      termsVersion: "p0-e2e-mvp-2026-07-16",
      createdAt: sceneArtifact.createdAt,
      notes: "scene.jsonのparticlesパラメータとvisual用途seedから完全ループ素材visual-loop.mp4を生成。"
    });

    return artifact;
  }
}
