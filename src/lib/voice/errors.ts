import { VoiceError, VoiceErrorCode } from "./types";

const MESSAGES: Record<VoiceErrorCode, string> = {
  permission_denied: "Microphone permission was denied. Allow microphone access and try again.",
  permission_timeout: "The microphone permission request timed out. Please try again.",
  no_device: "No microphone was found. Connect or select a microphone and try again.",
  device_unavailable: "The selected microphone is unavailable. Choose another microphone in settings.",
  recorder_unsupported_mimetype: "This device does not support a compatible audio recording format.",
  recorder_failed: "The microphone stopped unexpectedly. Please try again.",
  no_audio_captured: "No audio was captured. Please try again.",
  provider_not_configured: "Add your Gemini API key in Speech-to-Text settings before starting voice input.",
  recording_already_active: "Voice input is already active in another window.",
  upload_failed: "The recording could not be uploaded for transcription. Please try again.",
  polling_timeout: "The transcription service took too long to prepare the recording. Please try again.",
  provider_returned_no_text: "No speech was recognized. Please try again.",
  stt_request_failed: "Transcription failed. Please try again.",
  stt_aborted: "Transcription was cancelled.",
  unknown: "Unable to start voice input. Please try again.",
};

export function voiceError(
  code: VoiceErrorCode,
  cause?: unknown,
  message?: string
): VoiceError {
  return {
    code,
    message: message || MESSAGES[code],
    cause,
    retryable: !["permission_denied", "provider_not_configured", "recording_already_active"].includes(code),
  };
}

export function voiceErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return MESSAGES.unknown;
}

export function microphoneVoiceError(error: unknown): VoiceError {
  if (!(error instanceof DOMException)) return voiceError("unknown", error);

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return voiceError("permission_denied", error);
    case "NotFoundError":
      return voiceError("no_device", error);
    case "NotReadableError":
      return voiceError("device_unavailable", error, "Your microphone is being used by another app. Close it and try again.");
    case "OverconstrainedError":
      return voiceError("device_unavailable", error);
    default:
      return voiceError("unknown", error, error.message || undefined);
  }
}
