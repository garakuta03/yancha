export type ErrorCode =
  | "CONFIG_MISSING"
  | "CONFIG_INVALID"
  | "STAGE_FAILED"
  | "STAGE_NOT_IMPLEMENTED"
  | "ARTIFACT_INVALID"
  | "POLICY_VIOLATION"
  | "CLIENT_ERROR";

export class YanchaError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "YanchaError";
    this.code = code;
    if ("cause" in options) {
      this.cause = options.cause;
    }
  }
}

export class StageError extends YanchaError {
  readonly stageId: string;

  constructor(stageId: string, message: string, options: { cause?: unknown } = {}) {
    super("STAGE_FAILED", message, options);
    this.name = "StageError";
    this.stageId = stageId;
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
