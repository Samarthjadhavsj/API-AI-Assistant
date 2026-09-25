import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceInput } from "./useVoiceInput";
import { voiceRecorderController } from "@/lib/voice/VoiceRecorderController";
import { MultipartSttAdapter } from "@/lib/stt/MultipartSttAdapter";
import { GeminiLiveSttAdapter } from "@/lib/stt/GeminiLiveSttAdapter";

const app = vi.hoisted(() => ({
  selectedSttProvider: { provider: "gemini-transcribe", variables: {} as Record<string, string> },
}));

vi.mock("@/contexts", () => ({
  useApp: () => ({
    selectedSttProvider: app.selectedSttProvider,
    allSttProviders: [
      { id: "gemini-transcribe", curl: "" },
      { id: "openai", curl: "" },
      { id: "claude", curl: "" },
      { id: "custom", curl: "" },
    ],
  }),
}));

let startSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  startSpy = vi.spyOn(voiceRecorderController, "start").mockResolvedValue(true as any);
});

afterEach(() => vi.restoreAllMocks());

const start = () => renderHook(() => useVoiceInput()).result.current.start();

describe("voice input with the selected voice provider", () => {
  it("a provider without speech-to-text is refused before recording, with a clear message", async () => {
    app.selectedSttProvider = { provider: "claude", variables: { api_key: "k", model: "m" } };

    await expect(start()).rejects.toMatchObject({
      code: "provider_unsupported",
      message:
        "Claude's API doesn't accept audio, so it can't transcribe speech. Choose another voice provider in Settings → Voice Transcription.",
    });
    // No recording started, and no fallback to Gemini
    expect(startSpy).not.toHaveBeenCalled();
  });

  it("an incomplete provider is refused with what's missing", async () => {
    app.selectedSttProvider = { provider: "openai", variables: { model: "gpt-transcribe" } };

    await expect(start()).rejects.toMatchObject({
      code: "provider_not_configured",
      message: "OpenAI voice input isn't set up (API key required). Finish it in Settings → Voice Transcription.",
    });
    expect(startSpy).not.toHaveBeenCalled();
  });

  it("a ready provider records with its own adapter", async () => {
    app.selectedSttProvider = { provider: "openai", variables: { api_key: "sk", model: "gpt-transcribe" } };

    await start();

    const adapter = startSpy.mock.calls[0][0].adapter;
    expect(adapter).toBeInstanceOf(MultipartSttAdapter);
    expect(adapter.providerId).toBe("openai");
  });

  it("a ready custom endpoint records with its own adapter", async () => {
    app.selectedSttProvider = {
      provider: "custom",
      variables: { endpoint: "http://localhost:9000/v1/audio/transcriptions", model: "small" },
    };

    await start();

    expect(startSpy.mock.calls[0][0].adapter).toBeInstanceOf(MultipartSttAdapter);
    expect(startSpy.mock.calls[0][0].adapter.providerId).toBe("custom");
  });

  it("Gemini Voice works as before", async () => {
    app.selectedSttProvider = {
      provider: "gemini-transcribe",
      variables: { api_key: "g", model: "gemini-3.5-transcribe-live" },
    };

    await start();

    expect(startSpy.mock.calls[0][0].adapter).toBeInstanceOf(GeminiLiveSttAdapter);
  });
});
