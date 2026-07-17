import type { AppConfig } from "../config.js";
import { Logger, YanchaError } from "@yancha/core";

export interface LlmMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface LlmGenerateRequest {
  readonly messages: readonly LlmMessage[];
  readonly temperature: number;
  readonly responseFormat?: "text" | "json";
}

export interface LlmGenerateResponse {
  readonly text: string;
  readonly provider: string;
  readonly model: string;
}

export interface LlmClient {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
  generateJson<T>(request: LlmGenerateRequest, validate: (value: unknown) => T): Promise<T>;
}

export function createLlmClient(config: AppConfig): LlmClient {
  if (config.llm.provider === "openai") {
    return new OpenAiLlmClient(config);
  }
  if (config.llm.provider === "gemini") {
    return new GeminiLlmClient(config);
  }
  return new MockLlmClient(config.llm.model);
}

const maxRetries = 3;
const baseRetryDelayMs = 1_000;

abstract class BaseLlmClient implements LlmClient {
  abstract generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;

  async generateJson<T>(request: LlmGenerateRequest, validate: (value: unknown) => T): Promise<T> {
    const response = await this.generate({ ...request, responseFormat: "json" });
    return validate(extractJson(response.text));
  }
}

class OpenAiLlmClient extends BaseLlmClient {
  private readonly logger: Logger;

  constructor(private readonly config: AppConfig) {
    super();
    this.logger = new Logger(config.logLevel);
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const response = await fetchWithRetry(
      `${this.config.llm.openaiBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.llm.openaiApiKey}`
        },
        body: JSON.stringify({
          model: this.config.llm.model,
          messages: request.messages,
          temperature: request.temperature,
          ...(request.responseFormat === "json" ? { response_format: { type: "json_object" } } : {})
        })
      },
      "OpenAI API",
      this.logger
    );

    const payload = (await response.json()) as OpenAiChatResponse;
    const text = payload.choices[0]?.message.content;
    if (!text) {
      throw new YanchaError("CLIENT_ERROR", "OpenAI APIの応答に本文が含まれていません。");
    }

    return { text, provider: "openai", model: this.config.llm.model };
  }
}

class GeminiLlmClient extends BaseLlmClient {
  private readonly logger: Logger;

  constructor(private readonly config: AppConfig) {
    super();
    this.logger = new Logger(config.logLevel);
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const url = `${this.config.llm.geminiBaseUrl}/models/${this.config.llm.model}:generateContent?key=${this.config.llm.geminiApiKey}`;
    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: request.messages.map((message) => ({
            role: message.role === "system" ? "user" : message.role,
            parts: [{ text: message.content }]
          })),
          generationConfig: {
            temperature: request.temperature,
            ...(request.responseFormat === "json" ? { responseMimeType: "application/json" } : {})
          }
        })
      },
      "Gemini API",
      this.logger
    );

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates[0]?.content.parts.map((part) => part.text).join("\n").trim();
    if (!text) {
      throw new YanchaError("CLIENT_ERROR", "Gemini APIの応答に本文が含まれていません。");
    }

    return { text, provider: "gemini", model: this.config.llm.model };
  }
}

class MockLlmClient extends BaseLlmClient {
  constructor(private readonly model: string) {
    super();
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const userPrompt = findLastUserMessage(request.messages)?.content ?? "";
    if (request.responseFormat === "json") {
      return { text: JSON.stringify(createMockJsonResponse(userPrompt), null, 2), provider: "mock", model: this.model };
    }

    const title = extractPromptValue(userPrompt, "タイトル") ?? "静かな夜の睡眠導入";
    const minutes = Number(extractPromptValue(userPrompt, "想定尺（分）") ?? "10");
    const text = [
      `# ${title}`,
      "",
      "## 導入",
      "今は、今日の予定や考えごとから少し距離を置き、静かな時間に入っていきます。",
      "呼吸は無理に変えず、自然な速さのまま、吐く息だけを少し長く感じてください。",
      "",
      "## 呼吸誘導",
      "鼻からゆっくり息を吸い、肩の力が抜ける余白を作ります。",
      "口元をゆるめ、吐く息と一緒に、体の重さを寝具へ預けていきます。",
      "この音声はリラックスのための案内です。眠れない時は、ただ横になって休むだけでも十分です。",
      "",
      "## ボディスキャン",
      "額、目のまわり、頬、あごの順に、こわばりがほどける感覚を確かめます。",
      "首、肩、腕、手のひらへと意識を移し、力を入れる必要がない場所を見つけます。",
      "胸、お腹、腰、脚、足先まで、呼吸に合わせて静かに確認していきます。",
      "",
      "## 情景描写",
      "目の前には、夜明け前の湖があります。水面は暗い青をたたえ、遠くの森だけがやわらかく揺れています。",
      "小さな桟橋に腰を下ろし、涼しい空気と、一定の間隔で寄せる水音を感じます。",
      "何かを成し遂げる必要はありません。ただ、ここにいて、音と呼吸の間に身を置きます。",
      "",
      "## 終わり",
      `このまま${Math.max(3, Math.round(minutes / 2))}分ほど、言葉の間を広く取りながら、静かな描写を続けます。`,
      "まぶたの奥が暗く落ち着いてきたら、音声の先を追わず、そのまま休んでください。"
    ].join("\n");

    return { text, provider: "mock", model: this.model };
  }
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const trimmed = candidate.trim();
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  const jsonText = objectStart >= 0 && objectEnd > objectStart ? trimmed.slice(objectStart, objectEnd + 1) : trimmed;

  try {
    return JSON.parse(jsonText) as unknown;
  } catch (error) {
    // デバッグ用に元応答の冒頭を切り詰めてメッセージに含める
    const snippet = text.trim().slice(0, 200);
    throw new YanchaError("CLIENT_ERROR", `LLM応答のJSON解析に失敗しました。応答冒頭: ${snippet}`, { cause: error });
  }
}

async function fetchWithRetry(url: string, init: RequestInit, label: string, logger: Logger): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok) {
      return response;
    }
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      throw new YanchaError("CLIENT_ERROR", `${label}の呼び出しに失敗しました: ${response.status} ${response.statusText}`);
    }

    lastResponse = response;
    if (attempt <= maxRetries) {
      const waitMs = resolveRetryDelayMs(response, attempt);
      // 何回目の試行が失敗し、何ミリ秒待って再試行するかを記録する
      logger.warn(`${label}の呼び出しに失敗しました。再試行します。`, {
        attempt,
        status: response.status,
        waitMs
      });
      await sleep(waitMs);
    }
  }

  throw new YanchaError(
    "CLIENT_ERROR",
    `${label}の呼び出しに失敗しました: ${lastResponse?.status ?? "unknown"} ${lastResponse?.statusText ?? ""}`.trim()
  );
}

function resolveRetryDelayMs(response: Response, attempt: number): number {
  // Retry-Afterは秒数形式のみ尊重する。HTTP-date形式は決定論のため扱わず指数バックオフにフォールバックする
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1_000;
    }
  }
  return baseRetryDelayMs * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createMockJsonResponse(prompt: string): unknown {
  if (prompt.includes("metadata.json")) {
    const storyline = extractPromptValue(prompt, "storyline") ?? "静かな夜の雨音と淡い粒子の動きを描きます。";
    return {
      title: "雨の夜にひらく静かなアンビエンス",
      description: `${storyline}\n\n雨音と淡い粒子の動きを中心にした、作業前後や休憩時間にも流しやすいノーボイス環境動画です。`,
      tags: ["雨音", "環境音", "ノーボイス", "アンビエンス", "リラックス"],
      thumbnailPrompt: "暗い窓辺に細い雨筋が重なり、淡い粒子が静かに浮かぶサムネ案"
    };
  }

  const title = extractPromptValue(prompt, "タイトル") ?? "雨の夜のアンビエンス";
  return {
    sceneId: "mock-rain-night",
    title,
    storyline: "静かな夜の雨音と淡い粒子の動きで、落ち着いた時間を描きます。",
    durationSeconds: 60,
    seed: "mock-seed",
    audio: {
      preset: "rain",
      layers: [
        { id: "steady-rain", type: "rain", gain: 0.8 },
        { id: "soft-drops", type: "drops", gain: 0.35 }
      ]
    },
    visual: {
      preset: "particles",
      params: {
        particleCount: 240,
        drift: 0.35,
        brightness: 0.55,
        loopSeconds: 10
      }
    }
  };
}

function findLastUserMessage(messages: readonly LlmMessage[]): LlmMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      return message;
    }
  }
  return undefined;
}

function extractPromptValue(prompt: string, label: string): string | undefined {
  const line = prompt.split("\n").find((candidate) => candidate.startsWith(`- ${label}:`));
  return line?.split(":").slice(1).join(":").trim();
}

interface OpenAiChatResponse {
  readonly choices: readonly {
    readonly message: {
      readonly content: string;
    };
  }[];
}

interface GeminiResponse {
  readonly candidates: readonly {
    readonly content: {
      readonly parts: readonly {
        readonly text: string;
      }[];
    };
  }[];
}
