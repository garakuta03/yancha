import { join } from "node:path";
import { readJson, writeJson, YanchaError } from "@yancha/core";
import type { CheckResult, ChecksData, MetadataData, StageArtifact, StageRunner, UniquenessData } from "../types/pipeline.js";
import { measureIntegratedLoudness, isLoudnessInRange, loudnessMaxLufs, loudnessMinLufs } from "./loudness.js";
import { lintText } from "./policy.js";
import { findDuplicates, readPastUniqueness } from "./uniquenessCheck.js";

export class ChecksStage implements StageRunner {
  readonly id = "checks" as const;
  readonly outputFile = "checks.json";

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<ChecksData>> {
    const createdAt = new Date().toISOString();
    const metadataArtifact = await readJson<StageArtifact<MetadataData>>(join(context.videoDir, "metadata.json"));
    const uniquenessArtifact = await readJson<StageArtifact<UniquenessData>>(join(context.videoDir, "uniqueness.json"));
    const pastUniqueness = await readPastUniqueness(context.videoDir, context.videoId);

    const results: CheckResult[] = [
      checkMetadataPolicy(metadataArtifact.data),
      checkUniqueness(uniquenessArtifact.data, pastUniqueness),
      await checkLoudness(join(context.videoDir, "final.mp4"))
    ];
    const data: ChecksData = {
      passed: results.every((result) => result.passed),
      results
    };
    const artifact: StageArtifact<ChecksData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt,
      data
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);

    if (!data.passed) {
      const failed = results.filter((result) => !result.passed).map((result) => result.name);
      throw new YanchaError("POLICY_VIOLATION", `自動チェックに失敗しました: ${failed.join(", ")}`);
    }

    return artifact;
  }
}

export function checkMetadataPolicy(metadata: MetadataData): CheckResult {
  const details = [
    ...lintField("title", metadata.title),
    ...lintField("description", metadata.description),
    ...metadata.tags.flatMap((tag, index) => lintField(`tags[${index}]`, tag))
  ];
  return {
    name: "metadataPolicy",
    passed: details.length === 0,
    details: details.length > 0 ? details : ["効能表現リンターの違反はありません。"]
  };
}

function checkUniqueness(current: UniquenessData, past: readonly UniquenessData[]): CheckResult {
  const duplicates = findDuplicates(current, past);
  return {
    name: "uniqueness",
    passed: duplicates.length === 0,
    details:
      duplicates.length > 0
        ? duplicates.map((videoId) => `完全一致するuniqueness.jsonがあります: ${videoId}`)
        : ["完全一致する過去動画はありません。"]
  };
}

async function checkLoudness(input: string): Promise<CheckResult> {
  const measured = await measureIntegratedLoudness(input);
  const passed = isLoudnessInRange(measured.integratedLufs);
  return {
    name: "loudness",
    passed,
    details: [`Integrated loudness: ${measured.integratedLufs} LUFS（許容範囲: ${loudnessMinLufs}〜${loudnessMaxLufs} LUFS）`]
  };
}

function lintField(field: string, text: string): readonly string[] {
  return lintText(text).map((message) => `${field}: ${message}`);
}
