import { Logger, YanchaError, toErrorMessage } from "@yancha/core";
import { createLlmClient } from "./clients/llm.js";
import { createStageRunners } from "./stages/index.js";
import { loadConfig } from "./config.js";
import { Orchestrator } from "./orchestrator.js";
import type { StageId } from "./types/pipeline.js";

const stageIds: readonly StageId[] = ["theme", "script", "narration", "music", "audioMix", "visual", "video", "metadata", "humanReview", "publish"];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const llmClient = createLlmClient(config);
  const orchestrator = new Orchestrator(config, logger, createStageRunners(llmClient));

  if (command === "pipeline") {
    const videoId = readOption(args, "--video-id") ?? createDefaultVideoId();
    const fromStage = parseStageId(readOption(args, "--from"));
    const toStage = parseStageId(readOption(args, "--to"));
    await orchestrator.run({
      videoId,
      ...(fromStage ? { fromStage } : {}),
      ...(toStage ? { toStage } : {})
    });
    return;
  }

  if (command === "stage:script") {
    const videoId = readOption(args, "--video-id") ?? args[1] ?? createDefaultVideoId();
    await orchestrator.run({ videoId, toStage: "script" });
    return;
  }

  if (command === "stage") {
    const videoId = readOption(args, "--video-id") ?? args[2] ?? createDefaultVideoId();
    const stage = parseStageId(args[1]);
    if (!stage) {
      throw new YanchaError("CONFIG_INVALID", `ステージ名を指定してください。利用可能: ${stageIds.join(", ")}`);
    }
    await orchestrator.run({ videoId, fromStage: stage, toStage: stage });
    return;
  }

  throw new YanchaError("CONFIG_INVALID", "コマンドを指定してください: pipeline または stage");
}

function readOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseStageId(value: string | undefined): StageId | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (stageIds.includes(value as StageId)) {
    return value as StageId;
  }
  throw new YanchaError("CONFIG_INVALID", `未知のステージです: ${value}`);
}

function createDefaultVideoId(): string {
  const normalized = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  return `video-${normalized}`;
}

main().catch((error: unknown) => {
  const prefix = error instanceof YanchaError ? `[${error.code}] ` : "";
  console.error(`${prefix}${toErrorMessage(error)}`);
  process.exitCode = 1;
});
