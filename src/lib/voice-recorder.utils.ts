export const DEFAULT_RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export function chooseRecordingMimeType(
  isTypeSupported: (mimeType: string) => boolean,
  mimeTypes = DEFAULT_RECORDING_MIME_TYPES
): string | undefined {
  return mimeTypes.find((mimeType) => isTypeSupported(mimeType));
}

export function microphoneConstraints(deviceId?: string): MediaStreamConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }
  return { audio };
}

export function microphoneErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return "Unable to start the microphone. Please try again.";
  }

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone permission was denied. Allow microphone access and try again.";
    case "NotFoundError":
      return "No microphone was found. Connect or select a microphone and try again.";
    case "NotReadableError":
      return "Your microphone is being used by another app. Close it and try again.";
    case "OverconstrainedError":
      return "The selected microphone is unavailable. Choose another microphone in settings.";
    default:
      return error.message || "Unable to start the microphone. Please try again.";
  }
}

export function isUsableTranscript(text: string | null | undefined): boolean {
  const value = (text || "").trim();
  return value.length > 0 && value !== "No transcription found";
}

export function formatRecordingDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
