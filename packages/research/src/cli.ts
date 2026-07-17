import { Logger, YanchaError, toErrorMessage } from "@yancha/core";
import { addCandidates, readCandidates, removeCandidate } from "./candidates.js";
import { collectSnapshots } from "./collect.js";
import { loadResearchConfig } from "./config.js";
import { discoverCandidates } from "./discover.js";
import { readKeywordsFile } from "./keywords.js";
import { activeLedgerEntries, addLedgerEntry, parseChannelId, readLedger, retireLedgerEntry } from "./ledger.js";
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
    const allEntries = await readLedger(paths.ledgerYaml);
    const ledger = activeLedgerEntries(allEntries);
    if (ledger.length === 0) {
      throw new YanchaError("CONFIG_INVALID", "有効な監視対象がありません。research add で登録するか、退役を見直してください。");
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

  if (command === "discover") {
    const confirmed = args.includes("--yes");
    const { keywords, settings } = await readKeywordsFile(paths.keywordsYaml);
    if (keywords.length === 0) {
      throw new YanchaError("CONFIG_INVALID", `キーワードが空です。${paths.keywordsYaml} に keywords を記載してください。`);
    }
    const ledger = await readLedger(paths.ledgerYaml);
    const candidates = await readCandidates(paths.candidatesYaml);
    const existingChannelIds = new Set<string>([
      ...ledger.map((entry) => entry.channelId),
      ...candidates.map((candidate) => candidate.channelId)
    ]);
    const client = createYoutubeClient(config);
    const found = await discoverCandidates({ keywords, settings, client, existingChannelIds, confirmed });
    const merged = await addCandidates(paths.candidatesYaml, found);
    logger.info("発掘が完了しました", { 新規候補: found.length, 候補総数: merged.length });
    return;
  }

  if (command === "candidates") {
    const candidates = await readCandidates(paths.candidatesYaml);
    if (candidates.length === 0) {
      logger.info("未承認の候補はありません");
      return;
    }
    for (const candidate of candidates) {
      logger.info("候補", { channelId: candidate.channelId, title: candidate.title, 登録者: candidate.subscriberCount, 一致: candidate.matchedKeywords.join(",") });
    }
    return;
  }

  if (command === "approve") {
    const channelId = args[1];
    if (!channelId) {
      throw new YanchaError("CONFIG_INVALID", "使い方: research approve <channelId>");
    }
    const candidates = await readCandidates(paths.candidatesYaml);
    const target = candidates.find((candidate) => candidate.channelId === channelId);
    if (!target) {
      throw new YanchaError("CONFIG_INVALID", `候補に存在しないchannelIdです: ${channelId}`);
    }
    await addLedgerEntry(paths.ledgerYaml, {
      channelId: target.channelId,
      note: target.title,
      tags: target.matchedKeywords,
      source: "discovered",
      approvedAt: new Date().toISOString()
    });
    await removeCandidate(paths.candidatesYaml, channelId);
    logger.info("候補を台帳へ昇格しました", { channelId });
    return;
  }

  if (command === "reject") {
    const channelId = args[1];
    if (!channelId) {
      throw new YanchaError("CONFIG_INVALID", "使い方: research reject <channelId>");
    }
    const remaining = await removeCandidate(paths.candidatesYaml, channelId);
    logger.info("候補を却下しました", { channelId, 残り候補: remaining.length });
    return;
  }

  if (command === "retire") {
    const channelId = args[1];
    if (!channelId) {
      throw new YanchaError("CONFIG_INVALID", "使い方: research retire <channelId>");
    }
    await retireLedgerEntry(paths.ledgerYaml, channelId);
    logger.info("監視対象を退役しました", { channelId });
    return;
  }

  if (command === "serve") {
    const port = Number(args[1] ?? process.env.RESEARCH_PORT ?? 5177);
    const store = createSqliteStore(paths.dbFile);
    startServer(store, port, paths.assetsDir);
    return;
  }

  throw new YanchaError("CONFIG_INVALID", "コマンドを指定してください: add / collect / serve / discover / candidates / approve / reject / retire");
}

main().catch((error: unknown) => {
  const prefix = error instanceof YanchaError ? `[${error.code}] ` : "";
  console.error(`${prefix}${toErrorMessage(error)}`);
  process.exitCode = 1;
});
