import { join } from "node:path";
import { basename } from "node:path";
import { readJson, writeJson } from "@yancha/core";

export interface LicenseEntry {
  readonly assetType: "scene" | "ambient" | "visual" | "video" | "metadata";
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

export async function appendLicenseEntry(videoDir: string, entry: LicenseEntry): Promise<void> {
  const path = join(videoDir, "license.json");
  const existing = await readExistingLicense(path);
  const document: LicenseDocument = {
    videoId: existing?.videoId ?? basename(videoDir),
    generatedAt: existing?.generatedAt ?? entry.createdAt,
    entries: [...(existing?.entries ?? []), entry]
  };
  await writeJson(path, document);
}

async function readExistingLicense(path: string): Promise<LicenseDocument | undefined> {
  try {
    return await readJson<LicenseDocument>(path);
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
