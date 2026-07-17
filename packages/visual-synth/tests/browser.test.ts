import puppeteer from "puppeteer";
import { launchRenderBrowser, SWIFTSHADER_CHROME_ARGS } from "../src/browser.js";

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(async () => ({ close: vi.fn() }))
  }
}));

describe("launchRenderBrowser", () => {
  beforeEach(() => {
    vi.mocked(puppeteer.launch).mockClear();
  });

  it("executablePath指定時はpuppeteer.launchへ渡す", async () => {
    await launchRenderBrowser({ executablePath: "/usr/bin/google-chrome" });

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: [...SWIFTSHADER_CHROME_ARGS],
      executablePath: "/usr/bin/google-chrome"
    });
  });

  it("executablePath未指定時はpuppeteer既定で起動する", async () => {
    await launchRenderBrowser();

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: [...SWIFTSHADER_CHROME_ARGS]
    });
  });
});
