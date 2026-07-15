import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addLedgerEntry, parseChannelId, readLedger } from "../src/ledger.js";

describe("parseChannelId", () => {
  test("channel URLからIDを抽出する", () => {
    expect(parseChannelId("https://www.youtube.com/channel/UC1234567890abcdefghABCD")).toBe("UC1234567890abcdefghABCD");
  });

  test("生のIDはそのまま返す", () => {
    expect(parseChannelId("UC1234567890abcdefghABCD")).toBe("UC1234567890abcdefghABCD");
  });

  test("未対応URLは日本語エラーで失敗する", () => {
    expect(() => parseChannelId("https://www.youtube.com/@example")).toThrow("channelIdを特定できません");
  });
});

describe("ledger 読み書き", () => {
  test("ファイルが無ければ空配列", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ledger-"));
    expect(await readLedger(join(dir, "ledger.yaml"))).toEqual([]);
  });

  test("追加した内容を読み戻せる／重複はスキップ", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ledger-"));
    const path = join(dir, "ledger.yaml");
    await addLedgerEntry(path, { channelId: "UCaaa", note: "睡眠系大手", tags: ["sleep"] });
    const after = await addLedgerEntry(path, { channelId: "UCaaa", note: "重複", tags: [] });
    expect(after).toHaveLength(1);

    const reloaded = await readLedger(path);
    expect(reloaded[0]?.channelId).toBe("UCaaa");
    expect(reloaded[0]?.note).toBe("睡眠系大手");
    expect((await readFile(path, "utf8")).length).toBeGreaterThan(0);
  });
});
