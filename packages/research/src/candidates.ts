import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import type { Candidate } from "./types.js";

export async function readCandidates(path: string): Promise<Candidate[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const parsed = parse(raw) as { candidates?: Candidate[] } | null;
  return parsed?.candidates ?? [];
}

async function writeCandidates(path: string, candidates: readonly Candidate[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringify({ candidates }), "utf8");
}

export async function addCandidates(path: string, incoming: readonly Candidate[]): Promise<Candidate[]> {
  const current = await readCandidates(path);
  const known = new Set(current.map((candidate) => candidate.channelId));
  const merged = [...current];
  for (const candidate of incoming) {
    if (!known.has(candidate.channelId)) {
      known.add(candidate.channelId);
      merged.push(candidate);
    }
  }
  await writeCandidates(path, merged);
  return merged;
}

export async function removeCandidate(path: string, channelId: string): Promise<Candidate[]> {
  const current = await readCandidates(path);
  const remaining = current.filter((candidate) => candidate.channelId !== channelId);
  await writeCandidates(path, remaining);
  return remaining;
}
