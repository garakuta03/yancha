import { YanchaError } from "./errors.js";
import type { LogLevel } from "./logger.js";

export type LlmProvider = "mock" | "openai" | "gemini";

export interface AppConfig {
  readonly logLevel: LogLevel;
  readonly assetsDir: string;
  readonly llm: {
    readonly provider: LlmProvider;
    readonly model: string;
    readonly openaiApiKey?: string;
    readonly openaiBaseUrl: string;
    readonly geminiApiKey?: string;
    readonly geminiBaseUrl: string;
  };
  readonly comfyuiBaseUrl: string;
  readonly ffmpegPath: string;
}

const logLevels = new Set<LogLevel>(["debug", "info", "warn", "error"]);
const llmProviders = new Set<LlmProvider>(["mock", "openai", "gemini"]);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const logLevel = parseLogLevel(env.YANCHA_LOG_LEVEL ?? "info");
  const assetsDir = valueOrDefault(env.YANCHA_ASSETS_DIR, "assets");
  const provider = parseLlmProvider(valueOrDefault(env.YANCHA_LLM_PROVIDER, "gemini"));
  const model = valueOrDefault(env.YANCHA_LLM_MODEL, defaultModelFor(provider));

  if (model.length === 0) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 YANCHA_LLM_MODEL が未設定です。使用するLLMモデル名を指定してください。");
  }

  if (provider === "openai" && !env.OPENAI_API_KEY) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 OPENAI_API_KEY が未設定です。OpenAIを使う場合はAPIキーを設定してください。");
  }

  if (provider === "gemini" && !env.GEMINI_API_KEY) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 GEMINI_API_KEY が未設定です。Geminiを使う場合はAPIキーを設定してください。");
  }

  return {
    logLevel,
    assetsDir,
    llm: {
      provider,
      model,
      openaiBaseUrl: valueOrDefault(env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
      geminiBaseUrl: valueOrDefault(env.GEMINI_BASE_URL, "https://generativelanguage.googleapis.com/v1beta"),
      ...(env.OPENAI_API_KEY ? { openaiApiKey: env.OPENAI_API_KEY } : {}),
      ...(env.GEMINI_API_KEY ? { geminiApiKey: env.GEMINI_API_KEY } : {})
    },
    comfyuiBaseUrl: valueOrDefault(env.COMFYUI_BASE_URL, "http://127.0.0.1:8188"),
    ffmpegPath: valueOrDefault(env.FFMPEG_PATH, "ffmpeg")
  };
}

function valueOrDefault(value: string | undefined, defaultValue: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : defaultValue;
}

function parseLogLevel(value: string): LogLevel {
  if (logLevels.has(value as LogLevel)) {
    return value as LogLevel;
  }
  throw new YanchaError("CONFIG_INVALID", `環境変数 YANCHA_LOG_LEVEL の値が不正です: ${value}`);
}

function parseLlmProvider(value: string): LlmProvider {
  if (llmProviders.has(value as LlmProvider)) {
    return value as LlmProvider;
  }
  throw new YanchaError("CONFIG_INVALID", `環境変数 YANCHA_LLM_PROVIDER の値が不正です: ${value}`);
}

function defaultModelFor(provider: LlmProvider): string {
  if (provider === "gemini") {
    // gemini-1.5系は終了、2.5-flashも新規キーでは404(not available to new users)。
    // 疎通確認済みの3.x flashを既定にする
    return "gemini-3.5-flash";
  }
  if (provider === "openai") {
    return "";
  }
  return "local-mock";
}
