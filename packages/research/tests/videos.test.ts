import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { createSqliteStore } from "../src/store.js";
import {
  extractChecksPassed,
  extractCheckResults,
  extractUploadMode,
  extractUploadUrl,
  listVideoSummaries,
  readVideoDetail,
  stageProgressFromFiles,
  unwrapArtifactData
} from "../src/videos.js";

describe("videos 純関数", () => {
  test("成果物ラップからdataを取り出す", () => {
    expect(unwrapArtifactData({ videoId: "v1", stageId: "scene", createdAt: "t", data: { title: "夜" } })).toEqual({ title: "夜" });
    expect(() => unwrapArtifactData({ title: "夜" })).toThrow(/data/);
  });

  test("checksとuploadの値を抽出する", () => {
    const checks = { passed: false, results: [{ name: "metadataPolicy", passed: false, details: ["NG"] }] };
    expect(extractChecksPassed(checks)).toBe(false);
    expect(extractCheckResults(checks)).toEqual([{ name: "metadataPolicy", passed: false, details: ["NG"] }]);
    expect(extractUploadMode({ mode: "uploaded", url: "https://youtu.be/x" })).toBe("uploaded");
    expect(extractUploadUrl({ mode: "uploaded", url: "https://youtu.be/x" })).toBe("https://youtu.be/x");
  });

  test("ステージ有無をファイル名から判定する", () => {
    expect(stageProgressFromFiles(["theme.json", "checks.json", "review.md"])).toMatchObject({
      theme: true,
      scene: false,
      checks: true,
      review: true
    });
  });
});

describe("assets スキャナ", () => {
  test("欠損ファイルに寛容に一覧と詳細を返す", async () => {
    const assetsDir = await mkdtemp(join(tmpdir(), "yancha-assets-"));
    const videoDir = join(assetsDir, "vid-1");
    await mkdir(videoDir);
    await writeJson(join(videoDir, "scene.json"), {
      videoId: "vid-1",
      stageId: "scene",
      createdAt: "2026-07-17T00:00:00.000Z",
      data: { title: "雨の夜", storyline: "静かな雨の夜を描きます。" }
    });
    await writeJson(join(videoDir, "checks.json"), {
      videoId: "vid-1",
      stageId: "checks",
      createdAt: "2026-07-17T00:01:00.000Z",
      data: { passed: true, results: [{ name: "metadataPolicy", passed: true, details: ["OK"] }] }
    });
    await writeJson(join(videoDir, "upload.json"), {
      videoId: "vid-1",
      stageId: "upload",
      createdAt: "2026-07-17T00:02:00.000Z",
      data: { mode: "dry-run", requestBody: {} }
    });
    await writeJson(join(videoDir, "license.json"), {
      videoId: "vid-1",
      generatedAt: "2026-07-17T00:00:00.000Z",
      entries: [{ assetType: "scene", tool: "mock", createdAt: "2026-07-17T00:00:00.000Z" }]
    });
    await writeFile(join(videoDir, "review.md"), "- 人間レビュー項目\n", "utf8");

    const store = createSqliteStore(":memory:");
    store.setVideoReviewed("vid-1", "2026-07-17T01:00:00.000Z", "OK");

    const summaries = await listVideoSummaries(assetsDir, store);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      videoId: "vid-1",
      checksPassed: true,
      uploadMode: "dry-run",
      reviewedAt: "2026-07-17T01:00:00.000Z"
    });
    expect(summaries[0]?.stages.scene).toBe(true);
    expect(summaries[0]?.stages.audio).toBe(false);

    const detail = await readVideoDetail(assetsDir, "vid-1", store);
    expect(detail).toMatchObject({
      videoId: "vid-1",
      title: "雨の夜",
      storyline: "静かな雨の夜を描きます。",
      uploadUrl: null,
      reviewMarkdown: "- 人間レビュー項目\n"
    });
    expect(detail?.checks).toEqual([{ name: "metadataPolicy", passed: true, details: ["OK"] }]);
    expect(detail?.license).toEqual([{ assetType: "scene", tool: "mock", createdAt: "2026-07-17T00:00:00.000Z" }]);
    store.close();
  });

  test("存在しないassetsや動画は空またはnullを返す", async () => {
    const assetsDir = join(tmpdir(), "yancha-assets-missing");
    const store = createSqliteStore(":memory:");
    expect(await listVideoSummaries(assetsDir, store)).toEqual([]);
    expect(await readVideoDetail(assetsDir, "missing", store)).toBeNull();
    store.close();
  });
});

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
