import { assertSafeScriptText } from "../src/stages/scriptPolicy.js";

describe("assertSafeScriptText", () => {
  test("穏やかな休息表現は許可する", () => {
    expect(() => assertSafeScriptText("ゆっくり休むための静かな案内です。")).not.toThrow();
  });

  test("断定的な健康効能表現を拒否する", () => {
    expect(() => assertSafeScriptText("この音声で不眠が改善します。")).toThrow("断定的な健康効能表現");
  });
});
