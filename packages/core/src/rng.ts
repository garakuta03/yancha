import { createHash } from "node:crypto";

export function createRng(seed: string): () => number {
  const state = seedToState(seed);

  return () => {
    const current0 = state[0] ?? 0;
    const current1 = state[1] ?? 0;
    const current2 = state[2] ?? 0;
    const current3 = state[3] ?? 0;
    const value = current0 ^ (current0 << 11);
    const next = current3 ^ (current3 >>> 19) ^ value ^ (value >>> 8);
    state[0] = current1;
    state[1] = current2;
    state[2] = current3;
    state[3] = next;
    return (next >>> 0) / 0x1_0000_0000;
  };
}

export function deriveSeed(videoId: string, purpose: string): string {
  return createHash("sha256").update(`${videoId}:${purpose}`).digest("hex");
}

function seedToState(seed: string): Uint32Array {
  const hash = createHash("sha256").update(seed).digest();
  const state = new Uint32Array(4);
  for (let index = 0; index < state.length; index += 1) {
    state[index] = hash.readUInt32LE(index * 4);
  }
  if (state.every((value) => value === 0)) {
    state[0] = 0x9e37_79b9;
  }
  return state;
}
