import { describe, expect, it } from "vitest";
import {
  chooseRecordingMimeType,
  formatRecordingDuration,
  isUsableTranscript,
  microphoneConstraints,
  microphoneErrorMessage,
} from "./voice-recorder.utils";

describe("voice recorder utilities", () => {
  it("selects the first browser-supported recording format", () => {
    const selected = chooseRecordingMimeType((type) => type === "audio/ogg");

    expect(selected).toBe("audio/ogg");
  });

  it("leaves the format unset when the browser chooses the default", () => {
    expect(chooseRecordingMimeType(() => false)).toBeUndefined();
  });

  it("uses the default microphone when no device is configured", () => {
    expect(microphoneConstraints()).toEqual({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it("uses an exact configured microphone device", () => {
    expect(microphoneConstraints("microphone-1")).toEqual({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        deviceId: { exact: "microphone-1" },
      },
    });
  });

  it("turns permission and device failures into actionable messages", () => {
    expect(microphoneErrorMessage(new DOMException("Denied", "NotAllowedError"))).toContain(
      "permission was denied"
    );
    expect(microphoneErrorMessage(new DOMException("Missing", "NotFoundError"))).toContain(
      "No microphone was found"
    );
  });

  it("formats recording durations consistently", () => {
    expect(formatRecordingDuration(62_999)).toBe("1:02");
  });

  it("rejects empty or placeholder transcriptions", () => {
    expect(isUsableTranscript("hello")).toBe(true);
    expect(isUsableTranscript("   ")).toBe(false);
    expect(isUsableTranscript("No transcription found")).toBe(false);
  });
});
