import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendLicenseEntry, type LicenseDocument } from "../src/license.js";

describe("appendLicenseEntry", () => {
  test("license.jsonがなければ作成し、videoDir名をvideoIdにする", async () => {
    const videoDir = await mkdtemp(join(tmpdir(), "yancha-license-new-"));

    await appendLicenseEntry(videoDir, {
      assetType: "scene",
      tool: "test",
      provider: "local",
      modelOrPlan: "manual",
      termsVersion: "test",
      createdAt: "2026-07-16T00:00:00.000Z",
      notes: "テスト用"
    });

    const document = JSON.parse(await readFile(join(videoDir, "license.json"), "utf8")) as LicenseDocument;
    expect(document.videoId).toBe(videoDir.split("/").at(-1));
    expect(document.entries).toHaveLength(1);
  });

  test("既存のlicense.jsonにエントリを追記する", async () => {
    const videoDir = await mkdtemp(join(tmpdir(), "yancha-license-append-"));
    const entry = {
      assetType: "metadata" as const,
      tool: "test",
      provider: "local",
      modelOrPlan: "manual",
      termsVersion: "test",
      createdAt: "2026-07-16T00:00:00.000Z",
      notes: "テスト用"
    };

    await appendLicenseEntry(videoDir, { ...entry, assetType: "scene" });
    await appendLicenseEntry(videoDir, entry);

    const document = JSON.parse(await readFile(join(videoDir, "license.json"), "utf8")) as LicenseDocument;
    expect(document.entries.map((item) => item.assetType)).toEqual(["scene", "metadata"]);
  });
});
