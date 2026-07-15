import { YanchaError } from "@yancha/core";

export interface TtsClient {
  synthesize(): Promise<never>;
}

export interface MusicClient {
  generate(): Promise<never>;
}

export interface ComfyUiClient {
  enqueuePrompt(): Promise<never>;
}

export interface FfmpegClient {
  run(): Promise<never>;
}

export class StubTtsClient implements TtsClient {
  async synthesize(): Promise<never> {
    throw new YanchaError("STAGE_NOT_IMPLEMENTED", "TTS生成は未実装です。商用ライセンス確認後にHTTPクライアントを接続してください。");
  }
}

export class StubMusicClient implements MusicClient {
  async generate(): Promise<never> {
    throw new YanchaError("STAGE_NOT_IMPLEMENTED", "音楽・環境音生成は未実装です。商用ライセンス確認後に接続してください。");
  }
}

export class StubComfyUiClient implements ComfyUiClient {
  async enqueuePrompt(): Promise<never> {
    throw new YanchaError("STAGE_NOT_IMPLEMENTED", "ComfyUI連携は未実装です。フェーズ0ではMac上のHTTP API接続だけを想定します。");
  }
}

export class StubFfmpegClient implements FfmpegClient {
  async run(): Promise<never> {
    throw new YanchaError("STAGE_NOT_IMPLEMENTED", "ffmpeg実行ラッパーは未実装です。入出力仕様確定後に接続してください。");
  }
}
