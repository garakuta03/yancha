import { lintText } from "../src/stages/policy.js";

describe("lintText", () => {
  test("穏やかな休息表現は違反なしにする", () => {
    expect(lintText("ゆっくり休むための静かな案内です。")).toEqual([]);
  });

  test("断定的な健康効能表現を違反として返す", () => {
    expect(lintText("この音声で不眠が改善します。")).toEqual([
      "断定的な健康効能表現の疑いがあります: 改善(する|します|できる)",
      "断定的な健康効能表現の疑いがあります: 不眠(症)?が(治|改善)"
    ]);
  });
});
