import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_KEYWORDS_SETTINGS, estimateSearchUnits, readKeywordsFile } from "../src/keywords.js";

describe("estimateSearchUnits", () => {
  test("1語100ユニット", () => {
    expect(estimateSearchUnits(10)).toBe(1000);
  });
});

describe("readKeywordsFile", () => {
  test("ファイルが無ければ空keywordsと既定settings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kw-"));
    const file = await readKeywordsFile(join(dir, "keywords.yaml"));
    expect(file.keywords).toEqual([]);
    expect(file.settings.minSubscribers).toBe(DEFAULT_KEYWORDS_SETTINGS.minSubscribers);
    expect(file.settings.maxSubscribers).toBe(DEFAULT_KEYWORDS_SETTINGS.maxSubscribers);
  });

  test("settings未指定の項目は既定で補完する", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kw-"));
    const path = join(dir, "keywords.yaml");
    await writeFile(path, "keywords:\n  - 睡眠導入\nsettings:\n  minSubscribers: 500\n", "utf8");
    const file = await readKeywordsFile(path);
    expect(file.keywords).toEqual(["睡眠導入"]);
    expect(file.settings.minSubscribers).toBe(500);
    expect(file.settings.maxSubscribers).toBe(DEFAULT_KEYWORDS_SETTINGS.maxSubscribers);
    expect(file.settings.regionCode).toBe(DEFAULT_KEYWORDS_SETTINGS.regionCode);
  });

  test("maxSubscribers は YAML で上書きできる", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kw-"));
    const path = join(dir, "keywords.yaml");
    await writeFile(path, "keywords:\n  - 睡眠導入\nsettings:\n  minSubscribers: 500\n  maxSubscribers: 120000\n", "utf8");
    const file = await readKeywordsFile(path);
    expect(file.settings.maxSubscribers).toBe(120000);
  });

  test("maxSubscribers が minSubscribers 未満なら設定エラー", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kw-"));
    const path = join(dir, "keywords.yaml");
    await writeFile(path, "keywords:\n  - 睡眠導入\nsettings:\n  minSubscribers: 500\n  maxSubscribers: 499\n", "utf8");
    await expect(readKeywordsFile(path)).rejects.toMatchObject({ code: "CONFIG_INVALID" });
  });
});
