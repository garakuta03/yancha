import { join } from "node:path";
import { readJson, writeJson, YanchaError } from "@yancha/core";
import type { LlmClient } from "../clients/llm.js";
import { appendLicenseEntry } from "../license.js";
import type { MetadataData, SceneData, StageArtifact, StageRunner } from "../types/pipeline.js";
import { buildMetadataPrompt } from "./metadataPrompt.js";

export class MetadataStage implements StageRunner {
  readonly id = "metadata" as const;
  readonly outputFile = "metadata.json";

  constructor(private readonly llmClient: LlmClient) {}

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<MetadataData>> {
    const createdAt = new Date().toISOString();
    const sceneArtifact = await readJson<StageArtifact<SceneData>>(join(context.videoDir, "scene.json"));
    const scene = sceneArtifact.data;

    const metadata = await generateMetadata(this.llmClient, scene);
    const artifact: StageArtifact<MetadataData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt,
      data: metadata
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    await appendLicenseEntry(context.videoDir, {
      assetType: "metadata",
      tool: "yancha metadata stage",
      provider: "llm",
      modelOrPlan: "generateJson + metadata schema",
      termsVersion: "p0-e2e-mvp-2026-07-16",
      createdAt,
      notes: "LLMはタイトル、説明、タグ、サムネ案テキストのみを生成。descriptionはscene.storylineを含む。"
    });

    return artifact;
  }
}

export function validateMetadata(value: unknown, options: { readonly requiredStoryline?: string } = {}): MetadataData {
  const root = expectRecord(value, "metadata");
  const title = expectNonEmptyString(root.title, "title");
  const description = expectNonEmptyString(root.description, "description");
  const tags = validateTags(root.tags);
  const thumbnailPrompt = expectNonEmptyString(root.thumbnailPrompt, "thumbnailPrompt");

  if (options.requiredStoryline && !description.includes(options.requiredStoryline)) {
    throw invalid("descriptionにはscene.jsonのstorylineを含める必要があります。");
  }

  return {
    title,
    description,
    tags,
    thumbnailPrompt
  };
}

async function generateMetadata(llmClient: LlmClient, scene: SceneData): Promise<MetadataData> {
  try {
    return await llmClient.generateJson(
      {
        temperature: 0.3,
        responseFormat: "json",
        messages: [
          {
            role: "system",
            content: "あなたは睡眠/ヒーリング用ノーボイス環境動画のYouTubeメタデータ編集者です。必ずJSONオブジェクトだけを返してください。"
          },
          { role: "user", content: buildMetadataPrompt(scene) }
        ]
      },
      (value) => validateMetadata(value, { requiredStoryline: scene.storyline })
    );
  } catch (error) {
    if (error instanceof YanchaError && error.code === "ARTIFACT_INVALID") {
      throw error;
    }
    throw new YanchaError("ARTIFACT_INVALID", "metadata.jsonの生成に失敗しました。フォールバックせず停止します。", { cause: error });
  }
}

function validateTags(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 15) {
    throw invalid("tagsは1件以上15件以下の配列である必要があります。");
  }
  return value.map((tag, index) => expectNonEmptyString(tag, `tags[${index}]`));
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw invalid(`${path}はオブジェクトである必要があります。`);
}

function expectNonEmptyString(value: unknown, path: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  throw invalid(`${path}は空でない文字列である必要があります。`);
}

function invalid(message: string): YanchaError {
  return new YanchaError("ARTIFACT_INVALID", `metadata.jsonが不正です。${message}`);
}
