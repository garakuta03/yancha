import { readFile } from "node:fs/promises";
import { YanchaError } from "@yancha/core";
import { renderLoop, type VisualParams, type VisualPreset } from "./index.js";

interface CliOptions {
  readonly preset: VisualPreset;
  readonly paramsPath: string;
  readonly loopSeconds: number;
  readonly seed: string;
  readonly outPath: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const params = JSON.parse(await readFile(options.paramsPath, "utf8")) as VisualParams;
  await renderLoop({
    preset: options.preset,
    params,
    loopSeconds: options.loopSeconds,
    seed: options.seed,
    outPath: options.outPath
  });
  console.log(`ループ映像を書き出しました: ${options.outPath}`);
}

function parseArgs(args: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new YanchaError("CONFIG_INVALID", "引数は --key value の形式で指定してください。");
    }
    values.set(key.slice(2), value);
  }

  return {
    preset: expectPreset(values.get("preset")),
    paramsPath: expectString(values.get("params"), "params"),
    loopSeconds: Number(expectString(values.get("loop-seconds"), "loop-seconds")),
    seed: expectString(values.get("seed"), "seed"),
    outPath: expectString(values.get("out"), "out")
  };
}

function expectPreset(value: string | undefined): VisualPreset {
  if (value === "particles") {
    return value;
  }
  throw new YanchaError("CONFIG_INVALID", "presetはparticlesを指定してください。");
}

function expectString(value: string | undefined, name: string): string {
  if (value && value.length > 0) {
    return value;
  }
  throw new YanchaError("CONFIG_INVALID", `${name}を指定してください。`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
