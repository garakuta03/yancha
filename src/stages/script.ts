import { join } from "node:path";
import type { LlmClient } from "../clients/llm.js";
import { assertSafeScriptText } from "./scriptPolicy.js";
import { buildScriptPrompt, scriptSystemPrompt } from "./scriptPrompt.js";
import { createInitialLicense, writeLicenseJson } from "../license.js";
import { readJson, writeJson } from "@yancha/core";
import { writeText } from "../io/files.js";
import type { ScriptData, StageArtifact, StageRunner, ThemeData } from "../types/pipeline.js";

export class ScriptStage implements StageRunner {
  readonly id = "script" as const;
  readonly outputFile = "script.meta.json";

  constructor(private readonly llmClient: LlmClient) {}

  async run(context: { videoId: string; videoDir: string }): Promise<StageArtifact<ScriptData>> {
    const themeArtifact = await readJson<StageArtifact<ThemeData>>(join(context.videoDir, "theme.json"));
    const prompt = buildScriptPrompt(themeArtifact.data);
    const response = await this.llmClient.generate({
      temperature: 0.7,
      messages: [
        { role: "system", content: scriptSystemPrompt },
        { role: "user", content: prompt }
      ]
    });

    assertSafeScriptText(response.text);

    const scriptPath = join(context.videoDir, "script.md");
    await writeText(scriptPath, `${response.text.trim()}\n`);

    const artifact: StageArtifact<ScriptData> = {
      videoId: context.videoId,
      stageId: this.id,
      createdAt: new Date().toISOString(),
      data: {
        path: "script.md",
        title: themeArtifact.data.title,
        estimatedMinutes: themeArtifact.data.targetMinutes,
        safetyNotes: ["医療的効能の断定表現を禁止パターンで検査済み"],
        llmProvider: response.provider,
        llmModel: response.model
      }
    };

    await writeJson(join(context.videoDir, this.outputFile), artifact);
    await writeLicenseJson(
      context.videoDir,
      createInitialLicense(context.videoId, [
        {
          assetType: "script",
          tool: "LLM",
          provider: response.provider,
          modelOrPlan: response.model,
          termsVersion: "利用時点の契約条件を人間レビューで確認",
          createdAt: artifact.createdAt,
          notes: "台本生成。投稿前に権利・効能表現を人間レビューする。"
        }
      ])
    );

    return artifact;
  }
}
