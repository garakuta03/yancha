import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { YanchaError } from "@yancha/core";

const require = createRequire(import.meta.url);
const currentDir = fileURLToPath(new URL(".", import.meta.url));

export interface SceneServer {
  readonly origin: string;
  close(): Promise<void>;
}

export async function startSceneServer(): Promise<SceneServer> {
  const sceneRoot = resolve(currentDir, "..", "scenes");
  // threeのexportsは deep subpath を公開しないため、`.`解決(＝build/three.cjs)の隣の
  // build ディレクトリごと配信する（three.module.js は内部で three.core.js を import するため、
  // 単一ファイル配信では 500 になり scene.js の three 読み込みが失敗する）。
  const threeBuildDir = dirname(require.resolve("three"));

  const server = createServer((request, response) => {
    void handleRequest(request, response, sceneRoot, threeBuildDir);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new YanchaError("CONFIG_INVALID", "ローカル配信サーバーのポート取得に失敗しました。");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    }
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  sceneRoot: string,
  threeBuildDir: string
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/vendor/")) {
      const vendorPath = resolveInside(threeBuildDir, url.pathname.slice("/vendor".length));
      await sendFile(response, vendorPath);
      return;
    }

    const pathname = url.pathname === "/" ? "/particles/index.html" : url.pathname;
    const filePath = resolveInside(sceneRoot, pathname);
    await sendFile(response, filePath);
  } catch (error) {
    response.statusCode = error instanceof YanchaError ? 404 : 500;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(error instanceof Error ? error.message : "ローカル配信に失敗しました。");
  }
}

function resolveInside(root: string, pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const relative = normalized.startsWith(sep) ? normalized.slice(1) : normalized;
  const filePath = resolve(join(root, relative));
  if (!filePath.startsWith(`${root}${sep}`)) {
    throw new YanchaError("CONFIG_INVALID", "許可されていないパスへのアクセスです。");
  }
  return filePath;
}

async function sendFile(response: ServerResponse, path: string): Promise<void> {
  const body = await readFile(path);
  response.statusCode = 200;
  response.setHeader("content-type", contentType(path));
  response.setHeader("cache-control", "no-store");
  response.end(body);
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
