import { join } from "node:path";
import { writeJson } from "../io/json.js";
import type { StageArtifact, StageRunner, ThemeData } from "../types/pipeline.js";

export class ThemeStage implements StageRunner {
  readonly id = "theme" as const;
  readonly outputFile = "theme.json";

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<ThemeData>> {
    const artifact: StageArtifact<ThemeData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: new Date().toISOString(),
      data: {
        title: "静かな湖畔で眠りに向かう夜",
        keywords: ["睡眠導入", "呼吸", "ボディスキャン", "湖畔", "リラックス"],
        targetMinutes: 20,
        format: "sleep-guide",
        audience: "一日の終わりに静かに休みたい大人",
        tone: "穏やか、低刺激、ゆっくり"
      }
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    return artifact;
  }
}
