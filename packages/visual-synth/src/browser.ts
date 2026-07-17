import { YanchaError } from "@yancha/core";
import puppeteer, { type Browser } from "puppeteer";

// Chrome 150以降は自動SwiftShaderフォールバックが削除済み。
// このフラグ列を欠くとWebGL生成は成功しても例外なしで白画面動画になるため、必ず固定で渡す。
export const SWIFTSHADER_CHROME_ARGS = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--use-gl=angle",
  "--use-angle=swiftshader-webgl",
  "--enable-unsafe-swiftshader"
] as const;

export async function launchRenderBrowser(options?: { readonly executablePath?: string | undefined }): Promise<Browser> {
  try {
    return await puppeteer.launch({
      headless: true,
      args: [...SWIFTSHADER_CHROME_ARGS],
      ...(options?.executablePath ? { executablePath: options.executablePath } : {})
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new YanchaError(
      "CONFIG_INVALID",
      `Chromeの起動に失敗しました。環境変数 PUPPETEER_EXECUTABLE_PATH で実行体を指定できます。原因: ${reason}`,
      { cause: error }
    );
  }
}
