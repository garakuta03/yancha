import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readJson, runFfmpeg, writeJson } from "@yancha/core";
import { appendLicenseEntry } from "../license.js";
import type { SceneData, StageArtifact, StageRunner } from "../types/pipeline.js";
import { buildLoudnormMeasureArgs, buildMuxArgs, parseLoudnormMeasurement } from "./ffmpegArgs.js";

interface VideoStageData {
  readonly outputFile: "final.mp4";
  readonly visualInput: "visual-loop.mp4";
  readonly audioInput: "ambient.wav";
  readonly durationSeconds: number;
  readonly loudnessTargetLufs: -16;
  readonly loudnorm: {
    readonly inputI: string;
    readonly inputTp: string;
    readonly inputLra: string;
    readonly inputThresh: string;
    readonly targetOffset: string;
  };
}

export class VideoStage implements StageRunner {
  readonly id = "video" as const;
  readonly outputFile = "video.meta.json";

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<VideoStageData>> {
    const sceneArtifact = await readJson<StageArtifact<SceneData>>(join(context.videoDir, "scene.json"));
    const durationSeconds = sceneArtifact.data.durationSeconds;
    const visualLoop = join(context.videoDir, "visual-loop.mp4");
    const audio = join(context.videoDir, "ambient.wav");
    const output = join(context.videoDir, "final.mp4");

    const measurementResult = await runFfmpeg(buildLoudnormMeasureArgs(audio));
    const measured = parseLoudnormMeasurement(measurementResult.stderr);
    await runFfmpeg(buildMuxArgs({ visualLoop, audio, output, durationSeconds, measured }));

    const artifact: StageArtifact<VideoStageData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: sceneArtifact.createdAt,
      data: {
        outputFile: "final.mp4",
        visualInput: "visual-loop.mp4",
        audioInput: "ambient.wav",
        durationSeconds,
        loudnessTargetLufs: -16,
        loudnorm: measured
      }
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    await mkdir(join(context.videoDir, "logs"), { recursive: true });
    await writeFile(
      join(context.videoDir, "logs", "video.json"),
      `${JSON.stringify(
        {
          videoId: context.videoId,
          durationSeconds,
          visualInput: "visual-loop.mp4",
          audioInput: "ambient.wav",
          outputFile: "final.mp4",
          loudnessTargetLufs: -16,
          loudnorm: measured
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await appendLicenseEntry(context.videoDir, {
      assetType: "video",
      tool: "ffmpeg loudnorm + mux",
      provider: "yancha",
      modelOrPlan: "visual-loop.mp4を-stream_loopで尺まで伸ばし、ambient.wavをloudnorm 2パスで正規化して合成",
      termsVersion: "p0-e2e-mvp-2026-07-16",
      createdAt: sceneArtifact.createdAt,
      notes: "ループ素材は再レンダリングせず、ffmpegの-stream_loopと-tでdurationSecondsへ伸長。"
    });

    return artifact;
  }
}
