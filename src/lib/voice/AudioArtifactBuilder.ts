import { AudioArtifact } from "./types";

export function buildAudioArtifact(options: {
  chunks: Blob[];
  mimeType: string;
  startedAt: number;
  deviceId: string | null;
}): AudioArtifact | null {
  const blob = new Blob(options.chunks, { type: options.mimeType || "audio/webm" });
  if (blob.size === 0) return null;

  return {
    blob,
    mimeType: blob.type || "audio/webm",
    durationMs: Math.max(0, Date.now() - options.startedAt),
    sizeBytes: blob.size,
    deviceId: options.deviceId,
    chunkCount: options.chunks.length,
  };
}
