import { DEFAULT_FRAME_RATE, DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../src/index.js";

describe("visual-synth sanity", () => {
  it("P0の既定レンダリング設定を持つ", () => {
    expect(DEFAULT_FRAME_RATE).toBe(30);
    expect(DEFAULT_WIDTH).toBe(1920);
    expect(DEFAULT_HEIGHT).toBe(1080);
  });
});
