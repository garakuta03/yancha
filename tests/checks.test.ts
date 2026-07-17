import { checkMetadataPolicy } from "../src/stages/checks.js";
import type { MetadataData } from "../src/types/pipeline.js";

describe("checkMetadataPolicy", () => {
  test("metadataのNG効能表現を検出する", () => {
    const result = checkMetadataPolicy({
      title: "不眠が改善します",
      description: "静かな雨音の環境動画です。",
      tags: ["睡眠", "病気が治る"],
      thumbnailPrompt: "雨の窓辺"
    } satisfies MetadataData);

    expect(result.passed).toBe(false);
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("title:"),
        expect.stringContaining("tags[1]:")
      ])
    );
  });
});
