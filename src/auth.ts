import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { YanchaError } from "@yancha/core";
import { OAuth2Client } from "google-auth-library";
import type { AppConfig } from "./config.js";

const youtubeUploadScope = "https://www.googleapis.com/auth/youtube.upload";
const defaultAuthPort = 53682;

export async function runYoutubeAuth(config: AppConfig, options: { readonly port?: number } = {}): Promise<void> {
  assertOAuthClientConfig(config);
  const port = options.port ?? defaultAuthPort;
  const redirectUri = `http://127.0.0.1:${port}`;
  const oauth = new OAuth2Client(config.youtube.clientId, config.youtube.clientSecret, redirectUri);
  const authorizationUrl = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [youtubeUploadScope]
  });

  const code = await waitForAuthorizationCode(port, authorizationUrl);
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new YanchaError("CLIENT_ERROR", "refresh token が応答に含まれていません。再度 pnpm pipeline auth を実行し、同意画面で許可してください。");
  }

  console.log("YouTubeアップロード用 refresh token を取得しました。以下を .env の YOUTUBE_REFRESH_TOKEN に設定してください。");
  console.log(tokens.refresh_token);
}

function assertOAuthClientConfig(config: AppConfig): asserts config is AppConfig & {
  readonly youtube: {
    readonly clientId: string;
    readonly clientSecret: string;
  };
} {
  if (!config.youtube.clientId) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 YOUTUBE_CLIENT_ID が未設定です。");
  }
  if (!config.youtube.clientSecret) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 YOUTUBE_CLIENT_SECRET が未設定です。");
  }
}

function waitForAuthorizationCode(port: number, authorizationUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("認可に失敗しました。このタブを閉じてください。");
        closeServer(server);
        reject(new YanchaError("CLIENT_ERROR", `YouTube OAuth認可に失敗しました: ${error}`));
        return;
      }

      if (!code) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("YouTube OAuthの認可コードが見つかりません。");
        return;
      }

      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("認証が完了しました。このタブを閉じてターミナルに戻ってください。");
      closeServer(server);
      resolve(code);
    });

    server.once("error", (error) => {
      reject(new YanchaError("CLIENT_ERROR", `ローカル認証サーバの起動に失敗しました: ${port}`, { cause: error }));
    });

    server.listen(port, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      console.log(`YouTube OAuth認証を開始します。redirect_uri: http://127.0.0.1:${address.port}`);
      console.log("次のURLをブラウザで開いて認可してください。");
      console.log(authorizationUrl);
    });
  });
}

function closeServer(server: ReturnType<typeof createServer>): void {
  server.close((error) => {
    if (error) {
      console.error(`ローカル認証サーバの終了に失敗しました: ${error.message}`);
    }
  });
}
