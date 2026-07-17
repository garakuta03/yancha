import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readJson, YanchaError } from "@yancha/core";
import type { ChecksData, StageArtifact, StageRunner } from "../types/pipeline.js";
import type { UploadData } from "./upload.js";

interface ReviewData {
  readonly outputFile: "review.md";
  readonly videoUrl: string;
  readonly checksPassed: boolean;
  readonly manualChecklist: readonly string[];
}

const manualChecklist = [
  "YouTube Studio で Content IDクレームの有無を目視確認（API不可のため唯一の手段）",
  "目視での品質確認",
  "逆画像検索（映像キーフレーム）",
  "AI開示フラグの要否判断（P0は常時ON）",
  "効能表現の最終確認"
] as const;

export class ReviewStage implements StageRunner {
  readonly id = "review" as const;
  readonly outputFile = "review.md";

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<ReviewData>> {
    const uploadArtifact = await readJson<StageArtifact<UploadData>>(join(context.videoDir, "upload.json"));
    const checksArtifact = await readJson<StageArtifact<ChecksData>>(join(context.videoDir, "checks.json"));
    const videoUrl = resolveVideoUrl(uploadArtifact.data);
    const artifact: StageArtifact<ReviewData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: uploadArtifact.createdAt,
      data: {
        outputFile: this.outputFile,
        videoUrl,
        checksPassed: checksArtifact.data.passed,
        manualChecklist
      }
    };

    await writeFile(join(context.videoDir, this.outputFile), buildReviewMarkdown(artifact, checksArtifact.data), "utf8");
    return artifact;
  }
}

function resolveVideoUrl(upload: UploadData): string {
  if (upload.mode === "dry-run") {
    return "dry-run のためURLなし（限定公開アップロードは実行していません）。";
  }
  if (upload.url) {
    return upload.url;
  }
  throw new YanchaError("ARTIFACT_INVALID", "upload.jsonに限定公開動画URLが含まれていません。");
}

function buildReviewMarkdown(artifact: StageArtifact<ReviewData>, checks: ChecksData): string {
  const checkLines = checks.results.map(formatCheckResult).join("\n\n");
  const manualLines = artifact.data.manualChecklist.map((item) => `- [ ] ${item}`).join("\n");
  return [
    `# review: ${artifact.videoId}`,
    "",
    "## 限定公開動画URL",
    "",
    artifact.data.videoUrl,
    "",
    "## checks.json の結果",
    "",
    `総合結果: ${checks.passed ? "PASS" : "FAIL"}`,
    "",
    checkLines,
    "",
    "## 人間が確認する項目",
    "",
    manualLines,
    ""
  ].join("\n");
}

function formatCheckResult(result: ChecksData["results"][number]): string {
  const details = result.details.map((detail) => `  - ${detail}`).join("\n");
  return [`- ${result.passed ? "PASS" : "FAIL"} ${result.name}`, details].join("\n");
}
