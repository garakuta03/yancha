import { createRng, deriveSeed } from "../src/index.js";

describe("createRng", () => {
  test("同じseedから同じ乱数列を生成する", () => {
    const first = createRng("same-seed");
    const second = createRng("same-seed");

    expect([first(), first(), first(), first()]).toEqual([second(), second(), second(), second()]);
  });

  test("異なる用途のseedから異なる乱数列を生成する", () => {
    const audio = createRng(deriveSeed("video-1", "audio"));
    const visual = createRng(deriveSeed("video-1", "visual"));

    expect([audio(), audio(), audio()]).not.toEqual([visual(), visual(), visual()]);
  });

  test("0以上1未満の値を返す", () => {
    const rng = createRng("range-seed");
    const values = Array.from({ length: 20 }, () => rng());

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
