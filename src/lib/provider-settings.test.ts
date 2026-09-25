import { describe, expect, it } from "vitest";
import { restoreAiProviderSettings, restoreVoiceProviderSettings } from "./provider-settings";

describe("restoreAiProviderSettings", () => {
  it("starts empty on a fresh install", () => {
    expect(restoreAiProviderSettings({ configsRaw: null, otherProviderRaw: null, active: null })).toEqual({
      configs: {},
      otherProviderId: "",
    });
  });

  it("migrates an install that only saved the active provider", () => {
    const active = { provider: "claude", variables: { api_key: "k", model: "m" } };
    expect(restoreAiProviderSettings({ configsRaw: null, otherProviderRaw: null, active })).toEqual({
      configs: { claude: { api_key: "k", model: "m" } },
      otherProviderId: "claude",
    });
  });

  it("keeps every saved provider, with the active selection winning for its own", () => {
    const configsRaw = JSON.stringify({
      gemini: { api_key: "old", model: "gemini-3.5-flash-lite" },
      openai: { api_key: "o", model: "x" },
    });
    const active = { provider: "gemini", variables: { api_key: "new", model: "gemini-3.8-flash" } };
    expect(restoreAiProviderSettings({ configsRaw, otherProviderRaw: "openai", active })).toEqual({
      configs: {
        gemini: { api_key: "new", model: "gemini-3.8-flash" },
        openai: { api_key: "o", model: "x" },
      },
      otherProviderId: "openai",
    });
  });

  it("survives corrupt or odd saved data", () => {
    const odd = JSON.stringify({ claude: { api_key: "k", model: 5 }, groq: "nope", "": { a: "b" }, list: [1] });
    expect(restoreAiProviderSettings({ configsRaw: odd, otherProviderRaw: "gemini", active: null })).toEqual({
      configs: { claude: { api_key: "k" } },
      otherProviderId: "",
    });
    expect(restoreAiProviderSettings({ configsRaw: "{not json", otherProviderRaw: null, active: null }).configs).toEqual({});
  });
});

describe("restoreVoiceProviderSettings", () => {
  it("keeps Gemini Voice as the built-in, never the 'other' provider", () => {
    const active = { provider: "gemini-transcribe", variables: { api_key: "g", model: "gemini-3.8-live" } };
    expect(restoreVoiceProviderSettings({ configsRaw: null, otherProviderRaw: null, active })).toEqual({
      configs: { "gemini-transcribe": { api_key: "g", model: "gemini-3.8-live" } },
      otherProviderId: "",
    });
  });

  it("remembers another voice provider in use, and every provider's values", () => {
    const configsRaw = JSON.stringify({ "gemini-transcribe": { api_key: "g", model: "m" }, groq: { api_key: "q", model: "w" } });
    const active = { provider: "openai", variables: { api_key: "o", model: "gpt-transcribe" } };
    expect(restoreVoiceProviderSettings({ configsRaw, otherProviderRaw: null, active })).toEqual({
      configs: {
        "gemini-transcribe": { api_key: "g", model: "m" },
        groq: { api_key: "q", model: "w" },
        openai: { api_key: "o", model: "gpt-transcribe" },
      },
      otherProviderId: "openai",
    });
  });

  it("ignores an unreadable saved 'other' value", () => {
    const odd = JSON.stringify({ name: "old object" });
    expect(restoreVoiceProviderSettings({ configsRaw: null, otherProviderRaw: odd, active: null }).otherProviderId).toBe("");
    expect(restoreVoiceProviderSettings({ configsRaw: null, otherProviderRaw: "cohere", active: null }).otherProviderId).toBe("cohere");
  });
});
