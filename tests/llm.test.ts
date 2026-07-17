import type { AppConfig } from "../src/config.js";
import { createLlmClient, extractJson } from "../src/clients/llm.js";
import { YanchaError } from "@yancha/core";

describe("extractJson", () => {
  test("JSON文字列を解析する", () => {
    expect(extractJson('{"title":"雨の夜"}')).toEqual({ title: "雨の夜" });
  });

  test("JSONコードフェンスを除去して解析する", () => {
    expect(extractJson('```json\n{"title":"雨の夜"}\n```')).toEqual({ title: "雨の夜" });
  });

  test("前置き付き応答からJSONオブジェクトを抽出する", () => {
    expect(extractJson('以下がJSONです。\n{"title":"雨の夜","durationSeconds":60}\n以上です。')).toEqual({
      title: "雨の夜",
      durationSeconds: 60
    });
  });

  test("壊れたJSONはCLIENT_ERRORで失敗する", () => {
    expect(() => extractJson('{"title":')).toThrow(YanchaError);
    expect(() => extractJson('{"title":')).toThrow("JSON解析に失敗");
  });
});

describe("LlmClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("OpenAIのJSONモードではresponse_formatを送る", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] }));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createLlmClient(testConfig("openai"));
    await expect(client.generateJson(baseRequest(), validateOk)).resolves.toEqual({ ok: true });

    const body = JSON.parse(String(fetchCalls(fetchMock)[0]?.[1].body)) as Record<string, unknown>;
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("GeminiのJSONモードではresponseMimeTypeを送る", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createLlmClient(testConfig("gemini"));
    await expect(client.generateJson(baseRequest(), validateOk)).resolves.toEqual({ ok: true });

    const body = JSON.parse(String(fetchCalls(fetchMock)[0]?.[1].body)) as {
      generationConfig?: Record<string, unknown>;
    };
    expect(body.generationConfig?.responseMimeType).toBe("application/json");
  });

  test("429はRetry-Afterを尊重して再試行する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(429, "Too Many Requests", { "retry-after": "0" }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "成功" } }] }));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createLlmClient(testConfig("openai"));
    await expect(client.generate(baseRequest())).resolves.toMatchObject({ text: "成功" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("5xxは指数バックオフで最大3回まで再試行する", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(500, "Server Error"))
      .mockResolvedValueOnce(textResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(textResponse(500, "Server Error"))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "成功" } }] }));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createLlmClient(testConfig("openai"));
    const promise = client.generate(baseRequest());
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);

    await expect(promise).resolves.toMatchObject({ text: "成功" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 1_000);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 2_000);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(3, expect.any(Function), 4_000);
  });

  test("Retry-AfterがHTTP-date形式なら指数バックオフにフォールバックする", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(429, "Too Many Requests", { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "成功" } }] }));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createLlmClient(testConfig("openai"));
    const promise = client.generate(baseRequest());
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toMatchObject({ text: "成功" });
    // HTTP-dateは秒数として解釈できないため、1回目の待機は指数バックオフの1000msになる
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 1_000);
  });

  test("壊れたJSON応答のエラーメッセージに応答冒頭を含める", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ choices: [{ message: { content: "前置き {壊れた" } }] }));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createLlmClient(testConfig("openai"));
    await expect(client.generateJson(baseRequest(), validateOk)).rejects.toThrow("応答冒頭: 前置き");
  });

  test("429以外の4xxは再試行せずCLIENT_ERRORにする", async () => {
    const fetchMock = vi.fn(async () => textResponse(400, "Bad Request"));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createLlmClient(testConfig("openai"));
    const promise = client.generate(baseRequest());
    await expect(promise).rejects.toThrow(YanchaError);
    await expect(promise).rejects.toThrow("400 Bad Request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("mockのJSONモードはシーン風のJSONを返す", async () => {
    const client = createLlmClient(testConfig("mock"));
    const value = await client.generateJson(baseRequest(), (candidate) => candidate as { audio: { preset: string } });
    expect(value.audio.preset).toBe("rain");
  });
});

function baseRequest() {
  return {
    temperature: 0.2,
    messages: [{ role: "user" as const, content: "- タイトル: 雨の夜" }]
  };
}

function validateOk(value: unknown): { ok: true } {
  if (typeof value === "object" && value !== null && "ok" in value && value.ok === true) {
    return { ok: true };
  }
  throw new YanchaError("CLIENT_ERROR", "検証に失敗しました。");
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" }
  });
}

function textResponse(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response("", { status, statusText, headers });
}

function testConfig(provider: "mock" | "openai" | "gemini"): AppConfig {
  return {
    logLevel: "info",
    assetsDir: "assets",
    llm: {
      provider,
      model: "test-model",
      openaiApiKey: "openai-key",
      openaiBaseUrl: "https://example.test/openai",
      geminiApiKey: "gemini-key",
      geminiBaseUrl: "https://example.test/gemini"
    },
    comfyuiBaseUrl: "http://127.0.0.1:8188",
    ffmpegPath: "ffmpeg"
  };
}

function fetchCalls(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit][] {
  return fetchMock.mock.calls as [string, RequestInit][];
}
