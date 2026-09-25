import { describe, expect, it } from "vitest";
import {
  aiProviderReadiness,
  missingStatus,
  voiceInputBlocker,
  voiceProviderReadiness,
} from "./provider-status";

describe("missingStatus", () => {
  it("says Ready, or what's required", () => {
    expect(missingStatus([])).toBe("Ready");
    expect(missingStatus(["api_key"])).toBe("API key required");
    expect(missingStatus(["model"])).toBe("Model name required");
    expect(missingStatus(["model", "api_key"])).toBe("Model name and API key required");
    expect(missingStatus(["model", "api_key", "region"])).toBe("Model name, API key and Region required");
  });
});

describe("aiProviderReadiness", () => {
  it("needs every variable the request uses, listed model → key → the rest", () => {
    expect(aiProviderReadiness(["api_key", "model"], {})).toEqual({ ready: false, status: "Model name and API key required" });
    expect(aiProviderReadiness(["api_key", "model"], { model: "m" })).toEqual({ ready: false, status: "API key required" });
    expect(aiProviderReadiness(["api_key", "model"], { model: "m", api_key: "  " })).toEqual({ ready: false, status: "API key required" });
    expect(aiProviderReadiness(["api_key", "model"], { model: "m", api_key: "k" })).toEqual({ ready: true, status: "Ready" });
  });
});

describe("voiceProviderReadiness", () => {
  it.each(["claude", "perplexity", "ollama", "deepseek"])("%s has no speech-to-text", (id) => {
    expect(voiceProviderReadiness(id, { api_key: "k", model: "m" })).toEqual({
      ready: false,
      status: "No speech-to-text",
      unsupported: true,
    });
  });

  it.each(["openai", "grok", "mistral", "groq", "openrouter"])("%s needs a model name and API key", (id) => {
    expect(voiceProviderReadiness(id, {}).status).toBe("Model name and API key required");
    expect(voiceProviderReadiness(id, { model: "m", api_key: "k" })).toEqual({ ready: true, status: "Ready" });
  });

  it("Cohere also needs the language", () => {
    expect(voiceProviderReadiness("cohere", { model: "m", api_key: "k" }).status).toBe("Language required");
    expect(voiceProviderReadiness("cohere", { model: "m", api_key: "k", language: "en" }).ready).toBe(true);
  });

  it("Custom needs an endpoint and model; the key is optional", () => {
    expect(voiceProviderReadiness("custom", {}).status).toBe("Endpoint URL and Model name required");
    expect(voiceProviderReadiness("custom", { endpoint: "http://localhost:9000/stt", model: "small" })).toEqual({
      ready: true,
      status: "Ready",
    });
  });
});

describe("voiceInputBlocker", () => {
  it("leaves Gemini Voice (including older selections without a provider) to its own checks", () => {
    expect(voiceInputBlocker({ provider: "gemini-transcribe", variables: {} })).toBeNull();
    expect(voiceInputBlocker({ variables: {} })).toBeNull();
  });

  it("explains a provider without speech-to-text", () => {
    expect(voiceInputBlocker({ provider: "claude", variables: { api_key: "k", model: "m" } })).toEqual({
      unsupported: true,
      message:
        "Claude's API doesn't accept audio, so it can't transcribe speech. Choose another voice provider in Settings → Voice Transcription.",
    });
  });

  it("explains an incomplete setup", () => {
    expect(voiceInputBlocker({ provider: "openai", variables: { model: "gpt-transcribe" } })).toEqual({
      unsupported: false,
      message: "OpenAI voice input isn't set up (API key required). Finish it in Settings → Voice Transcription.",
    });
  });

  it("lets a ready provider through", () => {
    expect(voiceInputBlocker({ provider: "groq", variables: { model: "w", api_key: "k" } })).toBeNull();
  });
});
