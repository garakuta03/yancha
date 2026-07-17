import { join } from "node:path";
import { readJson, writeJson, YanchaError } from "@yancha/core";
import type { YoutubeUploadClient } from "../clients/youtube.js";
import type { ChecksData, MetadataData, StageArtifact, StageRunner } from "../types/pipeline.js";

export interface UploadRequestBody {
  readonly snippet: {
    readonly title: string;
    readonly description: string;
    readonly tags: readonly string[];
    readonly categoryId: string;
  };
  readonly status: {
    readonly privacyStatus: "unlisted";
    readonly containsSyntheticMedia: true;
    readonly selfDeclaredMadeForKids: false;
  };
}

export interface UploadData {
  readonly mode: "dry-run" | "uploaded";
  readonly requestBody: UploadRequestBody;
  readonly videoId?: string;
  readonly url?: string;
  readonly response?: unknown;
}

export class UploadStage implements StageRunner {
  readonly id = "upload" as const;
  readonly outputFile = "upload.json";

  constructor(
    private readonly options: {
      readonly dryRun: boolean;
      readonly youtubeClientFactory: () => Promise<YoutubeUploadClient>;
    }
  ) {}

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<UploadData>> {
    const createdAt = new Date().toISOString();
    const metadataArtifact = await readJson<StageArtifact<MetadataData>>(join(context.videoDir, "metadata.json"));
    const checksArtifact = await readJson<StageArtifact<ChecksData>>(join(context.videoDir, "checks.json"));
    if (!checksArtifact.data.passed) {
      throw new YanchaError("POLICY_VIOLATION", "checks.jsonが失敗状態のため、YouTubeアップロードを中止します。");
    }

    const requestBody = buildUploadBody(metadataArtifact.data);
    const data = this.options.dryRun
      ? dryRunData(requestBody)
      : await uploadedData(await this.options.youtubeClientFactory(), join(context.videoDir, "final.mp4"), requestBody);

    const artifact: StageArtifact<UploadData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt,
      data
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    return artifact;
  }
}

export function buildUploadBody(metadata: MetadataData): UploadRequestBody {
  return {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: "22"
    },
    status: {
      privacyStatus: "unlisted",
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false
    }
  };
}

function dryRunData(requestBody: UploadRequestBody): UploadData {
  return {
    mode: "dry-run",
    requestBody
  };
}

async function uploadedData(youtubeClient: YoutubeUploadClient, videoPath: string, requestBody: UploadRequestBody): Promise<UploadData> {
  const result = await youtubeClient.uploadVideo({ videoPath, body: requestBody });
  return {
    mode: "uploaded",
    requestBody,
    videoId: result.videoId,
    url: result.url,
    response: result.response
  };
}
