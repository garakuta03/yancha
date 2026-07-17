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

export async function launchRenderBrowser(): Promise<Browser> {
  return await puppeteer.launch({
    headless: true,
    args: [...SWIFTSHADER_CHROME_ARGS]
  });
}
