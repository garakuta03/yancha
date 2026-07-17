import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { YanchaError } from "./errors.js";

const execFileAsync = promisify(execFile);

export interface RunFfmpegOptions {
  readonly ffmpegPath?: string;
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface RunFfmpegResult {
  readonly stdout: string;
  readonly stderr: string;
}

export async function runFfmpeg(args: readonly string[], options: RunFfmpegOptions = {}): Promise<RunFfmpegResult> {
  const ffmpegPath = options.ffmpegPath ?? "ffmpeg";
  try {
    const { stdout, stderr } = await execFileAsync(ffmpegPath, [...args], {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: options.env } : {})
    });
    return { stdout, stderr };
  } catch (error) {
    const stderr = extractStderr(error);
    throw new YanchaError("FFMPEG_ERROR", `ffmpegの実行に失敗しました: ${stderr || "詳細不明"}`, { cause: error });
  }
}

function extractStderr(error: unknown): string {
  if (typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string") {
    return error.stderr.trim();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
