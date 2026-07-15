import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import { YanchaError } from "@yancha/core";
import type { LedgerEntry } from "./types.js";

export function parseChannelId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/channel\/(UC[\w-]{3,})/);
  if (match?.[1]) {
    return match[1];
  }
  if (/^UC[\w-]{3,}$/.test(trimmed)) {
    return trimmed;
  }
  throw new YanchaError("CONFIG_INVALID", `channelIdを特定できません: ${input}（channel/UC... のURLか生のUC...IDを指定してください）`);
}

export async function readLedger(ledgerYamlPath: string): Promise<LedgerEntry[]> {
  let raw: string;
  try {
    raw = await readFile(ledgerYamlPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const parsed = parse(raw) as { channels?: LedgerEntry[] } | null;
  return parsed?.channels ?? [];
}

export async function addLedgerEntry(ledgerYamlPath: string, entry: LedgerEntry): Promise<LedgerEntry[]> {
  const current = await readLedger(ledgerYamlPath);
  if (current.some((candidate) => candidate.channelId === entry.channelId)) {
    return current;
  }

  const next = [...current, { ...entry, addedAt: entry.addedAt ?? new Date().toISOString() }];
  await mkdir(dirname(ledgerYamlPath), { recursive: true });
  await writeFile(ledgerYamlPath, stringify({ channels: next }), "utf8");
  return next;
}
