import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { YanchaError } from "@yancha/core";
import type { ResearchStore } from "./store.js";

export interface VideoStageProgress {
  readonly [stage: string]: boolean;
}

export interface VideoSummary {
  readonly videoId: string;
  readonly stages: VideoStageProgress;
  readonly checksPassed: boolean | null;
  readonly uploadMode: "dry-run" | "uploaded" | null;
  readonly reviewedAt: string | null;
}

export interface VideoDetail extends VideoSummary {
  readonly title: string | null;
  readonly storyline: string | null;
  readonly checks: readonly VideoCheckResult[];
  readonly uploadUrl: string | null;
  readonly reviewMarkdown: string | null;
  readonly license: readonly VideoLicenseEntry[];
}

export interface VideoCheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly details: readonly string[];
}

export interface VideoLicenseEntry {
  readonly assetType: string;
  readonly tool: string;
  readonly createdAt: string;
}

const stageFiles = {
  theme: "theme.json",
  scene: "scene.json",
  audio: "audio.json",
  visual: "visual.json",
  video: "video.json",
  metadata: "metadata.json",
  checks: "checks.json",
  upload: "upload.json",
  review: "review.md"
} as const;

export async function listVideoSummaries(assetsDir: string, store: ResearchStore): Promise<VideoSummary[]> {
  const videoIds = await listVideoIds(assetsDir);
  const summaries = await Promise.all(videoIds.map((videoId) => readVideoSummary(assetsDir, videoId, store)));
  return summaries.sort((left, right) => left.videoId.localeCompare(right.videoId));
}

export async function readVideoDetail(assetsDir: string, videoId: string, store: ResearchStore): Promise<VideoDetail | null> {
  const videoDir = join(assetsDir, videoId);
  if (!(await isDirectory(videoDir))) {
    return null;
  }

  const summary = await readVideoSummary(assetsDir, videoId, store);
  const scene = await readOptionalJsonData(join(videoDir, "scene.json"));
  const checks = await readOptionalJsonData(join(videoDir, "checks.json"));
  const upload = await readOptionalJsonData(join(videoDir, "upload.json"));
  const reviewMarkdown = await readOptionalText(join(videoDir, "review.md"));
  const license = await readOptionalJson(join(videoDir, "license.json"));

  return {
    ...summary,
    title: extractStringProperty(scene, "title"),
    storyline: extractStringProperty(scene, "storyline"),
    checks: extractCheckResults(checks),
    uploadUrl: extractUploadUrl(upload),
    reviewMarkdown,
    license: extractLicenseEntries(license)
  };
}

export function unwrapArtifactData(value: unknown): unknown {
  if (!isRecord(value) || !("data" in value)) {
    throw new YanchaError("ARTIFACT_INVALID", "成果物JSONにdataがありません。");
  }
  return value.data;
}

export function extractChecksPassed(value: unknown): boolean | null {
  if (!isRecord(value)) {
    return null;
  }
  return typeof value.passed === "boolean" ? value.passed : null;
}

export function extractCheckResults(value: unknown): readonly VideoCheckResult[] {
  if (!isRecord(value) || !Array.isArray(value.results)) {
    return [];
  }

  return value.results.filter(isRecord).map((result) => ({
    name: typeof result.name === "string" ? result.name : "unknown",
    passed: result.passed === true,
    details: Array.isArray(result.details) ? result.details.filter((detail): detail is string => typeof detail === "string") : []
  }));
}

export function extractUploadMode(value: unknown): "dry-run" | "uploaded" | null {
  if (!isRecord(value)) {
    return null;
  }
  return value.mode === "dry-run" || value.mode === "uploaded" ? value.mode : null;
}

export function extractUploadUrl(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return typeof value.url === "string" && value.url.length > 0 ? value.url : null;
}

export function extractUploadVideoId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return typeof value.videoId === "string" && value.videoId.length > 0 ? value.videoId : null;
}

export function stageProgressFromFiles(fileNames: readonly string[]): VideoStageProgress {
  const files = new Set(fileNames);
  return Object.fromEntries(Object.entries(stageFiles).map(([stage, file]) => [stage, files.has(file)]));
}

async function readVideoSummary(assetsDir: string, videoId: string, store: ResearchStore): Promise<VideoSummary> {
  const videoDir = join(assetsDir, videoId);
  const fileNames = await listFileNames(videoDir);
  const checks = await readOptionalJsonData(join(videoDir, "checks.json"));
  const upload = await readOptionalJsonData(join(videoDir, "upload.json"));
  const review = store.getVideoReview(videoId);

  return {
    videoId,
    stages: stageProgressFromFiles(fileNames),
    checksPassed: extractChecksPassed(checks),
    uploadMode: extractUploadMode(upload),
    reviewedAt: review?.reviewedAt ?? null
  };
}

async function listVideoIds(assetsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(assetsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

async function listFileNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

async function readOptionalJsonData(path: string): Promise<unknown | null> {
  const json = await readOptionalJson(path);
  return json === null ? null : unwrapArtifactData(json);
}

async function readOptionalJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new YanchaError("ARTIFACT_INVALID", `JSONの形式が不正です: ${path}`, { cause: error });
    }
    throw error;
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

function extractStringProperty(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const property = value[key];
  return typeof property === "string" ? property : null;
}

function extractLicenseEntries(value: unknown): readonly VideoLicenseEntry[] {
  const entries = isRecord(value) && Array.isArray(value.entries) ? value.entries : Array.isArray(value) ? value : [];
  return entries.filter(isRecord).map((entry) => ({
    assetType: typeof entry.assetType === "string" ? entry.assetType : "",
    tool: typeof entry.tool === "string" ? entry.tool : "",
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : ""
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
