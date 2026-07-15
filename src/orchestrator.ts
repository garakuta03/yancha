import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { resolveVideoPaths } from "./paths.js";
import type { StageArtifact, StageId, StageRunner } from "./types/pipeline.js";

export interface RunOptions {
  readonly videoId: string;
  readonly fromStage?: StageId;
  readonly toStage?: StageId;
}

export class Orchestrator {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly stages: readonly StageRunner[]
  ) {}

  async run(options: RunOptions): Promise<readonly StageArtifact[]> {
    const videoDir = resolveVideoPaths(this.config, options.videoId).videoDir;
    await mkdir(videoDir, { recursive: true });

    const startIndex = options.fromStage ? this.findStageIndex(options.fromStage) : 0;
    const endIndex = options.toStage ? this.findStageIndex(options.toStage) : this.stages.length - 1;
    if (startIndex > endIndex) {
      throw new Error("開始ステージが終了ステージより後にあります。");
    }

    const artifacts: StageArtifact[] = [];
    for (const stage of this.stages.slice(startIndex, endIndex + 1)) {
      this.logger.info(`ステージを開始します: ${stage.id}`, { videoId: options.videoId });
      const artifact = await stage.run({ videoId: options.videoId, videoDir });
      artifacts.push(artifact);
      this.logger.info(`ステージが完了しました: ${stage.id}`, { outputFile: stage.outputFile });
    }

    return artifacts;
  }

  private findStageIndex(stageId: StageId): number {
    const index = this.stages.findIndex((stage) => stage.id === stageId);
    if (index === -1) {
      throw new Error(`未知のステージです: ${stageId}`);
    }
    return index;
  }
}
