import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readJson, YanchaError } from "@yancha/core";
import type { StageArtifact, UniquenessData } from "../types/pipeline.js";

export function findDuplicates(current: UniquenessData, past: readonly UniquenessData[]): readonly string[] {
  return past
    .filter((item) => item.videoId !== current.videoId)
    .filter((item) => uniquenessKey(item) === uniquenessKey(current))
    .map((item) => item.videoId);
}

export async function readPastUniqueness(videoDir: string, currentVideoId: string): Promise<readonly UniquenessData[]> {
  const assetsDir = dirname(videoDir);
  const entries = await readdir(assetsDir, { withFileTypes: true });
  const past: UniquenessData[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === currentVideoId) {
      continue;
    }

    const path = join(assetsDir, entry.name, "uniqueness.json");
    try {
      const artifact = await readJson<StageArtifact<UniquenessData>>(path);
      past.push(artifact.data);
    } catch (error) {
      if (isMissingFile(error)) {
        continue;
      }
      throw new YanchaError("ARTIFACT_INVALID", `過去動画のuniqueness.jsonを読み取れませんでした: ${path}`, { cause: error });
    }
  }

  return past;
}

function uniquenessKey(value: UniquenessData): string {
  return JSON.stringify({
    seed: value.seed,
    audioPreset: value.audioPreset,
    audioLayers: [...value.audioLayers],
    visualPreset: value.visualPreset,
    visualParams: sortedRecord(value.visualParams)
  });
}

function sortedRecord(value: Record<string, number | string>): Record<string, number | string> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
