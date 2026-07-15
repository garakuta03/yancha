import { join } from "node:path";
import { writeJson } from "./io/json.js";

export interface LicenseEntry {
  readonly assetType: "script" | "narration" | "music" | "ambient" | "visual" | "video" | "metadata";
  readonly tool: string;
  readonly provider: string;
  readonly modelOrPlan: string;
  readonly termsVersion: string;
  readonly createdAt: string;
  readonly notes: string;
}

export interface LicenseDocument {
  readonly videoId: string;
  readonly generatedAt: string;
  readonly entries: readonly LicenseEntry[];
}

export async function writeLicenseJson(videoDir: string, document: LicenseDocument): Promise<void> {
  await writeJson(join(videoDir, "license.json"), document);
}

export function createInitialLicense(videoId: string, entries: readonly LicenseEntry[]): LicenseDocument {
  return {
    videoId,
    generatedAt: new Date().toISOString(),
    entries
  };
}
