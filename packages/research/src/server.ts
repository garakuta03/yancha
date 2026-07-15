import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { buildReport } from "./report.js";
import type { ResearchStore } from "./store.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

export function createServer(store: ResearchStore): Hono {
  const app = new Hono();

  app.get("/api/report", (context) => {
    return context.json(buildReport(store));
  });

  app.get("/", async (context) => {
    const html = await readFile(join(currentDir, "web", "index.html"), "utf8");
    return context.html(html);
  });

  return app;
}

export function startServer(store: ResearchStore, port: number): void {
  const app = createServer(store);
  serve({ fetch: app.fetch, port });
  console.log(`[INFO] リサーチWebビューを起動しました: http://localhost:${port}`);
}
