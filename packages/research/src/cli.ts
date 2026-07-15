import { Logger, YanchaError, toErrorMessage } from "@yancha/core";
import { collectSnapshots } from "./collect.js";
import { loadResearchConfig } from "./config.js";
import { addLedgerEntry, parseChannelId, readLedger } from "./ledger.js";
import { resolveResearchPaths } from "./paths.js";
import { startServer } from "./server.js";
import { createSqliteStore } from "./store.js";
import { createYoutubeClient } from "./youtube.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const config = loadResearchConfig();
  const paths = resolveResearchPaths(config);
  const logger = new Logger(config.logLevel);

  if (command === "add") {
    const input = args[1];
    if (!input) {
      throw new YanchaError("CONFIG_INVALID", "使い方: research add <channel_url|channel_id> [メモ]");
    }
    const channelId = parseChannelId(input);
    const note = args[2] ?? "";
    const before = await readLedger(paths.ledgerYaml);
    const after = await addLedgerEntry(paths.ledgerYaml, { channelId, note, tags: [] });
    if (before.length === after.length) {
      logger.info("台帳には既に登録されています", { channelId, 件数: after.length });
      return;
    }
    logger.info("台帳に追加しました", { channelId, 件数: after.length });
    return;
  }

  if (command === "collect") {
    const ledger = await readLedger(paths.ledgerYaml);
    if (ledger.length === 0) {
      throw new YanchaError("CONFIG_INVALID", "台帳が空です。まず research add でチャンネルを登録してください。");
    }

    const client = createYoutubeClient(config);
    const store = createSqliteStore(paths.dbFile);
    try {
      const batch = await collectSnapshots({ ledger, client, store, snapshotsDir: paths.snapshotsDir });
      logger.info("スナップショットを取得しました", { capturedAt: batch.capturedAt, channels: batch.channels.length, videos: batch.videos.length });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "serve") {
    const port = Number(args[1] ?? process.env.RESEARCH_PORT ?? 5177);
    const store = createSqliteStore(paths.dbFile);
    startServer(store, port);
    return;
  }

  throw new YanchaError("CONFIG_INVALID", "コマンドを指定してください: add / collect / serve");
}

main().catch((error: unknown) => {
  const prefix = error instanceof YanchaError ? `[${error.code}] ` : "";
  console.error(`${prefix}${toErrorMessage(error)}`);
  process.exitCode = 1;
});
