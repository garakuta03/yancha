import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_KEYWORDS_SETTINGS, estimateSearchCalls, estimateStatUnits, readKeywordsFile } from "../src/keywords.js";

describe("estimateSearchCalls", () => {
  test("1キーワード1 search.list呼び出し", () => {
    expect(estimateSearchCalls(10)).toBe(10);
  });
});

describe("estimateStatUnits", () => {
  test("channels.list は50件ごとに1ユニット", () => {
    expect(estimateStatUnits(0)).toBe(0);
    expect(estimateStatUnits(50)).toBe(1);
    expect(estimateStatUnits(51)).toBe(2);
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
    expect(file.settings.searchCallGuardPerDay).toBe(DEFAULT_KEYWORDS_SETTINGS.searchCallGuardPerDay);
    expect(file.settings.unitGuard).toBe(DEFAULT_KEYWORDS_SETTINGS.unitGuard);
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

  test("searchCallGuardPerDay が正の数でなければ設定エラー", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kw-"));
    const path = join(dir, "keywords.yaml");
    await writeFile(path, "keywords:\n  - 睡眠導入\nsettings:\n  searchCallGuardPerDay: 0\n", "utf8");
    await expect(readKeywordsFile(path)).rejects.toMatchObject({ code: "CONFIG_INVALID" });
  });

  test("unitGuard が正の数でなければ設定エラー", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kw-"));
    const path = join(dir, "keywords.yaml");
    await writeFile(path, "keywords:\n  - 睡眠導入\nsettings:\n  unitGuard: 0\n", "utf8");
    await expect(readKeywordsFile(path)).rejects.toMatchObject({ code: "CONFIG_INVALID" });
  });
});
