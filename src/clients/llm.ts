import type { AppConfig } from "../config.js";
import { YanchaError } from "@yancha/core";

export interface LlmMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface LlmGenerateRequest {
  readonly messages: readonly LlmMessage[];
  readonly temperature: number;
}

export interface LlmGenerateResponse {
  readonly text: string;
  readonly provider: string;
  readonly model: string;
}

export interface LlmClient {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
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

class OpenAiLlmClient implements LlmClient {
  constructor(private readonly config: AppConfig) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const response = await fetch(`${this.config.llm.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.llm.openaiApiKey}`
      },
      body: JSON.stringify({
        model: this.config.llm.model,
        messages: request.messages,
        temperature: request.temperature
      })
    });

    if (!response.ok) {
      throw new YanchaError("CLIENT_ERROR", `OpenAI APIの呼び出しに失敗しました: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const text = payload.choices[0]?.message.content;
    if (!text) {
      throw new YanchaError("CLIENT_ERROR", "OpenAI APIの応答に本文が含まれていません。");
    }

    return { text, provider: "openai", model: this.config.llm.model };
  }
}

class GeminiLlmClient implements LlmClient {
  constructor(private readonly config: AppConfig) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const url = `${this.config.llm.geminiBaseUrl}/models/${this.config.llm.model}:generateContent?key=${this.config.llm.geminiApiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: request.messages.map((message) => ({
          role: message.role === "system" ? "user" : message.role,
          parts: [{ text: message.content }]
        })),
        generationConfig: {
          temperature: request.temperature
        }
      })
    });

    if (!response.ok) {
      throw new YanchaError("CLIENT_ERROR", `Gemini APIの呼び出しに失敗しました: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates[0]?.content.parts.map((part) => part.text).join("\n").trim();
    if (!text) {
      throw new YanchaError("CLIENT_ERROR", "Gemini APIの応答に本文が含まれていません。");
    }

    return { text, provider: "gemini", model: this.config.llm.model };
  }
}

class MockLlmClient implements LlmClient {
  constructor(private readonly model: string) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const userPrompt = findLastUserMessage(request.messages)?.content ?? "";
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
