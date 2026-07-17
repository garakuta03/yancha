import { join } from "node:path";
import { access } from "node:fs/promises";
import { readJson, writeJson } from "@yancha/core";
import type { StageArtifact, StageRunner, ThemeData } from "../types/pipeline.js";

export class ThemeStage implements StageRunner {
  readonly id = "theme" as const;
  readonly outputFile = "theme.json";

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<ThemeData>> {
    const outputPath = join(context.videoDir, this.outputFile);
    if (await exists(outputPath)) {
      return readJson<StageArtifact<ThemeData>>(outputPath);
    }

    const artifact: StageArtifact<ThemeData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: new Date().toISOString(),
      data: {
        title: "雨の夜",
        keywords: ["雨音", "夜", "環境音", "静かな時間", "リラックス"],
        targetMinutes: 1,
        format: "ambience",
        audience: "静かな環境音で落ち着いた時間を過ごしたい人",
        tone: "穏やか、低刺激、余白を残す"
      }
    };

    await writeJson(outputPath, artifact);
    return artifact;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
