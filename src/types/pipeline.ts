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

export interface AudioLayer {
  readonly id: string;
  readonly type: "rain" | "drops";
  readonly gain: number;
}

export interface VisualParams {
  readonly particleCount: number;
  readonly drift: number;
  readonly brightness: number;
  readonly loopSeconds: number;
}

export interface SceneData {
  readonly sceneId: string;
  readonly title: string;
  readonly storyline: string;
  readonly durationSeconds: number;
  readonly seed: string;
  readonly audio: {
    readonly preset: "rain";
    readonly layers: readonly AudioLayer[];
  };
  readonly visual: {
    readonly preset: "particles";
    readonly params: VisualParams;
  };
}

export interface UniquenessData {
  readonly videoId: string;
  readonly seed: string;
  readonly audioPreset: string;
  readonly audioLayers: readonly string[];
  readonly visualPreset: string;
  readonly visualParams: Record<string, number | string>;
  readonly createdAt: string;
}

export interface MetadataData {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly thumbnailPrompt: string;
}

export interface CheckResult {
  readonly name: "metadataPolicy" | "uniqueness" | "loudness";
  readonly passed: boolean;
  readonly details: readonly string[];
}

export interface ChecksData {
  readonly passed: boolean;
  readonly results: readonly CheckResult[];
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
