import { YanchaError } from "@yancha/core";
import type { LogLevel } from "@yancha/core";

export interface ResearchConfig {
  readonly youtubeApiKey: string;
  readonly youtubeBaseUrl: string;
  readonly dataDir: string;
  readonly logLevel: LogLevel;
}

const logLevels = new Set<LogLevel>(["debug", "info", "warn", "error"]);

export function loadResearchConfig(env: NodeJS.ProcessEnv = process.env): ResearchConfig {
  const youtubeApiKey = env.YOUTUBE_API_KEY?.trim() ?? "";
  if (youtubeApiKey.length === 0) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 YOUTUBE_API_KEY が未設定です。YouTube Data API v3 のキーを設定してください。");
  }

  const logLevel = (env.YANCHA_LOG_LEVEL?.trim() ?? "info") as LogLevel;
  if (!logLevels.has(logLevel)) {
    throw new YanchaError("CONFIG_INVALID", `環境変数 YANCHA_LOG_LEVEL の値が不正です: ${logLevel}`);
  }

  return {
    youtubeApiKey,
    youtubeBaseUrl: env.YOUTUBE_BASE_URL?.trim() || "https://www.googleapis.com/youtube/v3",
    dataDir: env.YANCHA_RESEARCH_DIR?.trim() || "research-data",
    logLevel
  };
}
