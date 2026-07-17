import { YanchaError } from "@yancha/core";

export const DEFAULT_SAMPLE_RATE = 44_100;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const HEADER_BYTES = 44;

export function encodeWavPcm16(channels: readonly Float32Array[], sampleRate = DEFAULT_SAMPLE_RATE): Buffer {
  if (channels.length !== CHANNELS) {
    throw new YanchaError("ARTIFACT_INVALID", "WAVは2chステレオのみ対応しています。");
  }
  const frameCount = channels[0]?.length ?? 0;
  if (frameCount === 0 || channels.some((channel) => channel.length !== frameCount)) {
    throw new YanchaError("ARTIFACT_INVALID", "WAVの全チャンネルは同じ長さである必要があります。");
  }

  const dataBytes = frameCount * CHANNELS * BYTES_PER_SAMPLE;
  const buffer = Buffer.alloc(HEADER_BYTES + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * CHANNELS * BYTES_PER_SAMPLE, 28);
  buffer.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  let offset = HEADER_BYTES;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      buffer.writeInt16LE(floatToPcm16(channels[channel]![frame]!), offset);
      offset += BYTES_PER_SAMPLE;
    }
  }

  return buffer;
}

function floatToPcm16(value: number): number {
  const clipped = Math.max(-1, Math.min(1, value));
  return clipped < 0 ? Math.round(clipped * 32768) : Math.round(clipped * 32767);
}
