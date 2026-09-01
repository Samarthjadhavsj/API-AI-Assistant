export type VoiceState =
  | "idle"
  | "requestingPermission"
  | "recording"
  | "finalizing"
  | "transcribing"
  | "error";

export type VoiceErrorCode =
  | "permission_denied"
  | "permission_timeout"
  | "no_device"
  | "device_unavailable"
  | "recorder_unsupported_mimetype"
  | "recorder_failed"
  | "no_audio_captured"
  | "provider_not_configured"
  | "recording_already_active"
  | "upload_failed"
  | "polling_timeout"
  | "provider_returned_no_text"
  | "stt_request_failed"
  | "stt_aborted"
  | "unknown";

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
  cause?: unknown;
  retryable: boolean;
}

export interface VoiceStateSnapshot {
  state: VoiceState;
  error: VoiceError | null;
  deviceId: string | null;
  startedAt: number | null;
  durationMs: number;
  level: number;
  /** Present only while a recorder owns an active MediaStream. */
  stream: MediaStream | null;
  activeOwnerId: string | null;
}

export interface AudioArtifact {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  deviceId: string | null;
  sampleRate?: number;
  chunkCount: number;
}

export interface SttResult {
  text: string;
  confidence?: number;
  providerId: string;
  raw?: unknown;
}

export interface SttAdapter {
  readonly kind: "multipart" | "live-websocket";
  readonly providerId: string;
  transcribe(
    artifact: AudioArtifact,
    options: { signal: AbortSignal; onPartial?: (text: string) => void }
  ): Promise<SttResult>;
}

export interface VoiceStartOptions {
  adapter: SttAdapter | null;
  deviceId?: string;
  maxDurationMs?: number;
  ownerId: string;
  onResult?: (result: SttResult) => void;
}
