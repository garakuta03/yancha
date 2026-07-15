export type StageId =
  | "theme"
  | "script"
  | "narration"
  | "music"
  | "audioMix"
  | "visual"
  | "video"
  | "metadata"
  | "humanReview"
  | "publish";

export interface StageArtifact<TData = unknown> {
  readonly videoId: string;
  readonly stageId: StageId;
  readonly createdAt: string;
  readonly data: TData;
}

export interface ThemeData {
  readonly title: string;
  readonly keywords: readonly string[];
  readonly targetMinutes: number;
  readonly format: "sleep-guide" | "healing-visual" | "sleep-story";
  readonly audience: string;
  readonly tone: string;
}

export interface ScriptData {
  readonly path: string;
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly safetyNotes: readonly string[];
  readonly llmProvider: string;
  readonly llmModel: string;
}

export interface PlaceholderData {
  readonly status: "stub" | "manual-required";
  readonly message: string;
  readonly expectedInputs: readonly string[];
  readonly expectedOutputs: readonly string[];
}

export interface PipelineContext {
  readonly videoId: string;
  readonly videoDir: string;
}

export interface StageRunner {
  readonly id: StageId;
  readonly outputFile: string;
  run(context: PipelineContext): Promise<StageArtifact>;
}
