import { buildUploadBody } from "../src/stages/upload.js";
import type { MetadataData } from "../src/types/pipeline.js";

describe("buildUploadBody", () => {
  test("AI開示と公開状態を固定する", () => {
    const body = buildUploadBody(metadata());

    expect(body.status.containsSyntheticMedia).toBe(true);
    expect(body.status.privacyStatus).toBe("unlisted");
    expect(body.status.selfDeclaredMadeForKids).toBe(false);
  });

  test("metadataからsnippetを組み立てる", () => {
    const body = buildUploadBody(metadata());

    expect(body.snippet).toEqual({
      title: "雨の夜",
      description: "静かな雨の環境動画です。",
      tags: ["雨音", "環境音"],
      categoryId: "22"
    });
  });
});

function metadata(): MetadataData {
  return {
    title: "雨の夜",
    description: "静かな雨の環境動画です。",
    tags: ["雨音", "環境音"],
    thumbnailPrompt: "雨の窓辺"
  };
}
