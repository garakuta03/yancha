import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LlmClient } from "../src/clients/llm.js";
import { writeJson } from "@yancha/core";
import { ScriptStage } from "../src/stages/script.js";
import type { StageArtifact, ThemeData } from "../src/types/pipeline.js";

describe("ScriptStage", () => {
  test("LLM応答からscript.md、メタJSON、license.jsonを書き出す", async () => {
    const videoDir = await mkdtemp(join(tmpdir(), "yancha-script-"));
    const theme: StageArtifact<ThemeData> = {
      videoId: "script-flow",
      stageId: "theme",
      createdAt: "2026-07-16T00:00:00.000Z",
      data: {
        title: "森の夜に呼吸を整える",
        keywords: ["睡眠導入", "森", "呼吸"],
        targetMinutes: 15,
        format: "sleep-guide",
        audience: "静かに休みたい人",
        tone: "穏やか"
      }
    };
    await writeJson(join(videoDir, "theme.json"), theme);

    const llmClient: LlmClient = {
      async generate() {
        return {
          provider: "mock",
          model: "test-model",
          text: "# 森の夜に呼吸を整える\n\n（間）\nゆっくり息を吐き、体を休ませます。"
        };
      },
      async generateJson() {
        throw new Error("このテストではJSON生成を使いません。");
      }
    };

    const artifact = await new ScriptStage(llmClient).run({ videoId: "script-flow", videoDir });

    await expect(readFile(join(videoDir, "script.md"), "utf8")).resolves.toContain("（間）");
    await expect(readFile(join(videoDir, "script.meta.json"), "utf8")).resolves.toContain("test-model");
    await expect(readFile(join(videoDir, "license.json"), "utf8")).resolves.toContain('"assetType": "script"');
    expect(artifact.data.llmProvider).toBe("mock");
  });

  test("NG表現を含むLLM応答は成果物化しない", async () => {
    const videoDir = await mkdtemp(join(tmpdir(), "yancha-script-ng-"));
    await writeJson(join(videoDir, "theme.json"), {
      videoId: "script-ng",
      stageId: "theme",
      createdAt: "2026-07-16T00:00:00.000Z",
      data: {
        title: "静かな夜",
        keywords: ["睡眠"],
        targetMinutes: 10,
        format: "sleep-guide",
        audience: "大人",
        tone: "穏やか"
      }
    } satisfies StageArtifact<ThemeData>);

    const llmClient: LlmClient = {
      async generate() {
        return {
          provider: "mock",
          model: "test-model",
          text: "この音声で不眠が改善します。"
        };
      },
      async generateJson() {
        throw new Error("このテストではJSON生成を使いません。");
      }
    };

    await expect(new ScriptStage(llmClient).run({ videoId: "script-ng", videoDir })).rejects.toThrow("断定的な健康効能表現");
  });
});
