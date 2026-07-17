import { resolve } from "node:path";
import type { ResearchConfig } from "./config.js";

export interface ResearchPaths {
  readonly dataDir: string;
  readonly ledgerYaml: string;
  readonly keywordsYaml: string;
  readonly candidatesYaml: string;
  readonly snapshotsDir: string;
  readonly dbFile: string;
  readonly assetsDir: string;
}

export function resolveResearchPaths(config: ResearchConfig): ResearchPaths {
  const dataDir = resolve(config.dataDir);
  return {
    dataDir,
    ledgerYaml: resolve(dataDir, "ledger.yaml"),
    keywordsYaml: resolve(dataDir, "keywords.yaml"),
    candidatesYaml: resolve(dataDir, "candidates.yaml"),
    snapshotsDir: resolve(dataDir, "snapshots"),
    dbFile: resolve(dataDir, "data.db"),
    assetsDir: config.assetsDir
  };
}

export function snapshotDirFor(config: ResearchConfig, capturedAt: string): string {
  const safe = capturedAt.replace(/:/g, "");
  return resolve(config.dataDir, "snapshots", safe);
}
