import { resolve } from "node:path";
import { resolveResearchPaths, snapshotDirFor } from "../src/paths.js";
import type { ResearchConfig } from "../src/config.js";

const config = {
  youtubeApiKey: "dummy",
  youtubeBaseUrl: "https://www.googleapis.com/youtube/v3",
  dataDir: "research-data",
  logLevel: "info"
} satisfies ResearchConfig;

describe("resolveResearchPaths", () => {
  test("dataDir配下の主要パスを解決する", () => {
    const paths = resolveResearchPaths(config);
    expect(paths.ledgerYaml).toBe(resolve("research-data", "ledger.yaml"));
    expect(paths.snapshotsDir).toBe(resolve("research-data", "snapshots"));
    expect(paths.dbFile).toBe(resolve("research-data", "data.db"));
  });

  test("候補とキーワードのパスを解決する", () => {
    const paths = resolveResearchPaths(config);
    expect(paths.keywordsYaml).toBe(resolve("research-data", "keywords.yaml"));
    expect(paths.candidatesYaml).toBe(resolve("research-data", "candidates.yaml"));
  });

  test("snapshotDirForはタイムスタンプでコロンを除去したディレクトリを返す", () => {
    const dir = snapshotDirFor(config, "2026-07-16T09:30:00.000Z");
    expect(dir).toBe(resolve("research-data", "snapshots", "2026-07-16T093000.000Z"));
  });
});
