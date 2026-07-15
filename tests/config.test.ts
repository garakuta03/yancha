import { loadConfig } from "../src/config.js";
import { YanchaError } from "../src/errors.js";

describe("loadConfig", () => {
  test("mock設定はAPIキーなしで読み込める", () => {
    const config = loadConfig({ YANCHA_LLM_PROVIDER: "mock", YANCHA_LLM_MODEL: "local" });
    expect(config.llm.provider).toBe("mock");
    expect(config.llm.model).toBe("local");
  });

  test("OpenAI選択時にAPIキーがなければ日本語で失敗する", () => {
    expect(() => loadConfig({ YANCHA_LLM_PROVIDER: "openai", YANCHA_LLM_MODEL: "gpt-example" })).toThrow(YanchaError);
    expect(() => loadConfig({ YANCHA_LLM_PROVIDER: "openai", YANCHA_LLM_MODEL: "gpt-example" })).toThrow("OPENAI_API_KEY が未設定です");
  });
});
