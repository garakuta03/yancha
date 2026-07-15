import { join } from "node:path";
import { writeJson } from "../io/json.js";
import type { PlaceholderData, StageArtifact, StageId, StageRunner } from "../types/pipeline.js";

export class PlaceholderStage implements StageRunner {
  constructor(
    readonly id: StageId,
    readonly outputFile: string,
    private readonly message: string,
    private readonly expectedInputs: readonly string[],
    private readonly expectedOutputs: readonly string[],
    private readonly status: "stub" | "manual-required" = "stub"
  ) {}

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<PlaceholderData>> {
    const artifact: StageArtifact<PlaceholderData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: new Date().toISOString(),
      data: {
        status: this.status,
        message: this.message,
        expectedInputs: this.expectedInputs,
        expectedOutputs: this.expectedOutputs
      }
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    return artifact;
  }
}
