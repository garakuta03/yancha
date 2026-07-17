import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { buildReport } from "./report.js";
import type { ResearchStore } from "./store.js";
import { listVideoSummaries, readVideoDetail } from "./videos.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  readonly assetsDir?: string;
  readonly now?: () => string;
}

export function createServer(store: ResearchStore, options: ServerOptions = {}): Hono {
  const app = new Hono();
  const assetsDir = options.assetsDir ?? resolve("assets");
  const now = options.now ?? (() => new Date().toISOString());

  app.get("/api/report", (context) => {
    return context.json(buildReport(store));
  });

  app.get("/api/videos", async (context) => {
    return context.json(await listVideoSummaries(assetsDir, store));
  });

  app.get("/api/videos/:id", async (context) => {
    const video = await readVideoDetail(assetsDir, context.req.param("id"), store);
    if (!video) {
      return context.json({ error: "動画が見つかりません。" }, 404);
    }
    return context.json(video);
  });

  app.post("/api/videos/:id/review", async (context) => {
    const body = await context.req.json().catch(() => ({})) as { note?: unknown };
    const note = typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim() : undefined;
    const reviewedAt = now();
    store.setVideoReviewed(context.req.param("id"), reviewedAt, note);
    return context.json({ videoId: context.req.param("id"), reviewedAt, note: note ?? null });
  });

  app.get("/", async (context) => {
    const html = await readFile(join(currentDir, "web", "index.html"), "utf8");
    return context.html(html);
  });

  return app;
}

export function startServer(store: ResearchStore, port: number, assetsDir = resolve("assets")): void {
  const app = createServer(store, { assetsDir });
  serve({ fetch: app.fetch, port });
  console.log(`[INFO] リサーチWebビューを起動しました: http://localhost:${port}`);
}
