export type StageId =
  | "theme"
  | "scene"
  | "audio"
  | "visual"
  | "video"
  | "metadata"
  | "checks"
  | "upload"
  | "review";

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
  readonly format: "ambience";
  readonly audience: string;
  readonly tone: string;
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
