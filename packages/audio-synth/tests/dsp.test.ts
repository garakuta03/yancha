import { createRng } from "@yancha/core";
import { createWhiteNoise, onePoleHighPass, onePoleLowPass } from "../src/dsp.js";

describe("dsp", () => {
  it("ホワイトノイズはseedで決定論的に生成される", () => {
    const a = createWhiteNoise(16, createRng("same-seed"));
    const b = createWhiteNoise(16, createRng("same-seed"));
    const c = createWhiteNoise(16, createRng("other-seed"));

    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...c]);
  });

  it("ローパスは急な変化をなだらかにする", () => {
    const input = new Float32Array([0, 1, 1, 1]);
    const result = onePoleLowPass(input, 1_000, 44_100).samples;

    expect(result[1]).toBeGreaterThan(0);
    expect(result[1]).toBeLessThan(1);
    expect(result[3]!).toBeGreaterThan(result[1]!);
  });

  it("ハイパスは直流成分を減衰させる", () => {
    const input = new Float32Array(128).fill(1);
    const result = onePoleHighPass(input, 200, 44_100).samples;

    expect(Math.abs(result[result.length - 1]!)).toBeLessThan(Math.abs(result[0]!));
  });
});
