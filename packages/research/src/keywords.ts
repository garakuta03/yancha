import { readFile } from "node:fs/promises";
import { YanchaError } from "@yancha/core";
import { parse } from "yaml";
import type { KeywordsFile, KeywordsSettings } from "./types.js";

export const DEFAULT_KEYWORDS_SETTINGS: KeywordsSettings = {
  minSubscribers: 100,
  maxSubscribers: 300000,
  maxCandidatesPerRun: 30,
  relevanceLanguage: "ja",
  regionCode: "JP",
  searchCallGuardPerDay: 100,
  unitGuard: 10000
};

export function estimateSearchCalls(keywordCount: number): number {
  return keywordCount;
}

export function estimateStatUnits(candidateCount: number): number {
  return Math.ceil(candidateCount / 50);
}

function validateKeywordsSettings(settings: KeywordsSettings): KeywordsSettings {
  if (settings.maxSubscribers < settings.minSubscribers) {
    throw new YanchaError(
      "CONFIG_INVALID",
      `maxSubscribers は minSubscribers 以上にしてください: minSubscribers=${settings.minSubscribers}, maxSubscribers=${settings.maxSubscribers}`
    );
  }
  if (!Number.isFinite(settings.searchCallGuardPerDay) || settings.searchCallGuardPerDay <= 0) {
    throw new YanchaError(
      "CONFIG_INVALID",
      `searchCallGuardPerDay は正の数にしてください: searchCallGuardPerDay=${settings.searchCallGuardPerDay}`
    );
  }
  if (!Number.isFinite(settings.unitGuard) || settings.unitGuard <= 0) {
    throw new YanchaError("CONFIG_INVALID", `unitGuard は正の数にしてください: unitGuard=${settings.unitGuard}`);
  }
  return settings;
}

export async function readKeywordsFile(path: string): Promise<KeywordsFile> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { keywords: [], settings: validateKeywordsSettings(DEFAULT_KEYWORDS_SETTINGS) };
    }
    throw error;
  }

  const parsed = parse(raw) as { keywords?: string[]; settings?: Partial<KeywordsSettings> } | null;
  const settings = validateKeywordsSettings({ ...DEFAULT_KEYWORDS_SETTINGS, ...(parsed?.settings ?? {}) });
  return {
    keywords: parsed?.keywords ?? [],
    settings
  };
}
