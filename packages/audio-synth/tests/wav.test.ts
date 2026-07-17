import { encodeWavPcm16 } from "../src/wav.js";

describe("wav", () => {
  it("PCM S16LE/44100Hz/2chのWAVヘッダを書き出す", () => {
    const wav = encodeWavPcm16([new Float32Array([0, 0.5]), new Float32Array([0, -0.5])]);

    expect(wav.length).toBe(44 + 2 * 2 * 2);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt32LE(24)).toBe(44_100);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    expect(wav.readUInt32LE(40)).toBe(8);
  });
});
