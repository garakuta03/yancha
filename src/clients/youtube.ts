import { readFile, stat } from "node:fs/promises";
import { YanchaError } from "@yancha/core";
import { OAuth2Client } from "google-auth-library";
import type { AppConfig } from "../config.js";
import type { UploadRequestBody } from "../stages/upload.js";

export interface YoutubeUploadResult {
  readonly videoId: string;
  readonly url: string;
  readonly response: unknown;
}

export interface YoutubeUploadClient {
  uploadVideo(options: {
    readonly videoPath: string;
    readonly body: UploadRequestBody;
  }): Promise<YoutubeUploadResult>;
}

export function createYoutubeUploadClient(config: AppConfig, fetchImpl: typeof fetch = fetch): YoutubeUploadClient {
  assertYoutubeConfig(config);
  const oauth = new OAuth2Client(config.youtube.clientId, config.youtube.clientSecret);
  oauth.setCredentials({ refresh_token: config.youtube.refreshToken });

  return {
    async uploadVideo(options) {
      const accessToken = await getAccessToken(oauth);
      const fileStat = await stat(options.videoPath);
      const sessionUrl = await createUploadSession(fetchImpl, accessToken, fileStat.size, options.body);
      const videoBytes = await readFile(options.videoPath);
      const responseJson = await uploadBytes(fetchImpl, sessionUrl, accessToken, videoBytes);
      const videoId = extractVideoId(responseJson);

      return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        response: responseJson
      };
    }
  };
}

function assertYoutubeConfig(config: AppConfig): asserts config is AppConfig & {
  readonly youtube: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly refreshToken: string;
  };
} {
  if (!config.youtube.clientId) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 YOUTUBE_CLIENT_ID が未設定です。");
  }
  if (!config.youtube.clientSecret) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 YOUTUBE_CLIENT_SECRET が未設定です。");
  }
  if (!config.youtube.refreshToken) {
    throw new YanchaError("CONFIG_MISSING", "環境変数 YOUTUBE_REFRESH_TOKEN が未設定です。");
  }
}

async function getAccessToken(oauth: OAuth2Client): Promise<string> {
  const token = await oauth.getAccessToken();
  const accessToken = typeof token === "string" ? token : token.token;
  if (!accessToken) {
    throw new YanchaError("CLIENT_ERROR", "YouTubeアップロード用のアクセストークンを取得できませんでした。");
  }
  return accessToken;
}

async function createUploadSession(
  fetchImpl: typeof fetch,
  accessToken: string,
  contentLength: number,
  body: UploadRequestBody
): Promise<string> {
  const url = new URL("https://www.googleapis.com/upload/youtube/v3/videos");
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("part", "snippet,status");

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(contentLength),
      "x-upload-content-type": "video/mp4"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new YanchaError("CLIENT_ERROR", `YouTubeアップロードセッションの作成に失敗しました: ${response.status} ${errorBody.slice(0, 200)}`);
  }

  const location = response.headers.get("location");
  if (!location) {
    throw new YanchaError("CLIENT_ERROR", "YouTubeアップロードセッションURLが応答に含まれていません。");
  }
  return location;
}

async function uploadBytes(fetchImpl: typeof fetch, sessionUrl: string, accessToken: string, videoBytes: Buffer): Promise<unknown> {
  const response = await fetchImpl(sessionUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "video/mp4",
      "content-length": String(videoBytes.byteLength)
    },
    body: videoBytes
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new YanchaError("CLIENT_ERROR", `YouTube動画本体のアップロードに失敗しました: ${response.status} ${errorBody.slice(0, 200)}`);
  }

  return response.json() as Promise<unknown>;
}

function extractVideoId(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" && value.id.length > 0) {
    return value.id;
  }
  throw new YanchaError("CLIENT_ERROR", "YouTube APIの応答に動画IDが含まれていません。");
}
