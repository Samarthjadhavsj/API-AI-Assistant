import { describe, expect, it } from "vitest";
import {
  findGeminiModel,
  formatGeminiQuota,
  geminiLiveProfileFor,
  GEMINI_RESPONSE_MODELS,
  GEMINI_VOICE_MODELS,
  type GeminiModelOption,
} from "./gemini-models.constants";

const rpdValue = (m: GeminiModelOption) => (m.quota.rpd === "unlimited" ? Infinity : m.quota.rpd);

/** Stable sort, highest first: equal values keep their listed order. */
const sortedBy = (models: readonly GeminiModelOption[], value: (m: GeminiModelOption) => number) =>
  models
    .map((model, index) => ({ model, index }))
    .sort((a, b) => value(b.model) - value(a.model) || a.index - b.index)
    .map(({ model }) => model.id);

describe("AI Response models", () => {
  it("are listed in the exact order, highest daily quota first", () => {
    expect(GEMINI_RESPONSE_MODELS.map((m) => [m.name, formatGeminiQuota(m.quota)])).toEqual([
      ["Gemini 3.5 Flash Lite", "500 requests/day"],
      ["Gemini 3.1 Flash Lite", "500 requests/day"],
      ["Gemini 2.5 Flash", "20 requests/day"],
      ["Gemini 3 Flash", "20 requests/day"],
      ["Gemini 3.5 Flash", "20 requests/day"],
      ["Gemini 3.8 Flash", "20 requests/day"],
    ]);
  });

  it("use the Gemini API model IDs", () => {
    expect(GEMINI_RESPONSE_MODELS.map((m) => m.id)).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-3-flash-preview",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
    ]);
  });

  it("order matches the quota data (RPD high → low, ties keep their order)", () => {
    const ids = GEMINI_RESPONSE_MODELS.map((m) => m.id);
    expect(sortedBy(GEMINI_RESPONSE_MODELS, rpdValue)).toEqual(ids);
    // Not alphabetical
    expect([...ids].sort()).not.toEqual(ids);
  });
});

describe("Voice models", () => {
  it("are listed in the exact order, highest tokens per minute first", () => {
    expect(GEMINI_VOICE_MODELS.map((m) => [m.name, formatGeminiQuota(m.quota)])).toEqual([
      ["Gemini 2.5 Flash Native Audio Dialog", "Unlimited · 1M tokens/min"],
      ["Gemini 3 Flash Live", "Unlimited · 65K tokens/min"],
      ["Gemini 3.8 Live", "Unlimited · 65K tokens/min"],
      ["Gemini 3.8 Live Extended Thinking", "Unlimited · 65K tokens/min"],
      ["Gemini 3.5 Live Translate", "Unlimited · 20K tokens/min"],
      ["Gemini 3.5 Transcribe Live", "Unlimited · 20K tokens/min"],
    ]);
  });

  it("use the Gemini Live API model IDs", () => {
    expect(GEMINI_VOICE_MODELS.map((m) => m.id)).toEqual([
      "gemini-2.5-flash-native-audio-preview-12-2025",
      "gemini-3.1-flash-live-preview",
      "gemini-3.8-live",
      "gemini-3.8-live-extended-thinking",
      "gemini-3.5-live-translate-preview",
      "gemini-3.5-transcribe-live",
    ]);
  });

  it("all have unlimited daily requests, so they're ordered by TPM (ties keep their order)", () => {
    expect(GEMINI_VOICE_MODELS.every((m) => m.quota.rpd === "unlimited")).toBe(true);
    expect(sortedBy(GEMINI_VOICE_MODELS, (m) => m.quota.tpm ?? 0)).toEqual(
      GEMINI_VOICE_MODELS.map((m) => m.id)
    );
  });

  it("have no duplicate IDs in either list", () => {
    for (const list of [GEMINI_RESPONSE_MODELS, GEMINI_VOICE_MODELS]) {
      expect(new Set(list.map((m) => m.id)).size).toBe(list.length);
    }
  });
});

describe("geminiLiveProfileFor", () => {
  it("keeps Transcribe Live on its original text + segments setup", () => {
    expect(geminiLiveProfileFor("gemini-3.5-transcribe-live")).toEqual({
      responseModality: "TEXT",
      transcript: "segments",
    });
  });

  it("drives native-audio and conversational Live models with audio responses", () => {
    for (const id of [
      "gemini-2.5-flash-native-audio-preview-12-2025",
      "gemini-3.1-flash-live-preview",
      "gemini-3.8-live",
      "gemini-3.8-live-extended-thinking",
    ]) {
      expect(geminiLiveProfileFor(id)).toMatchObject({ responseModality: "AUDIO", transcript: "stream" });
    }
    expect(geminiLiveProfileFor("gemini-3.8-live-extended-thinking")?.thinkingLevel).toBe("low");
  });

  it("gives Live Translate trailing silence so its last words are transcribed", () => {
    expect(geminiLiveProfileFor("gemini-3.5-live-translate-preview")).toMatchObject({
      responseModality: "TEXT",
      transcript: "stream",
      trailingSilenceMs: 1200,
    });
  });

  it("guesses a profile for custom Live IDs, and none for batch models", () => {
    expect(geminiLiveProfileFor("gemini-9-transcribe-live")?.transcript).toBe("segments");
    expect(geminiLiveProfileFor("gemini-9-live-preview")).toMatchObject({ responseModality: "AUDIO" });
    expect(geminiLiveProfileFor("gemini-9-flash-native-audio-latest")).toMatchObject({ responseModality: "AUDIO" });
    expect(geminiLiveProfileFor("gemini-3.5-transcribe")).toBeNull();
    expect(geminiLiveProfileFor("")).toBeNull();
    expect(geminiLiveProfileFor(undefined)).toBeNull();
    // Model IDs are case-sensitive
    expect(geminiLiveProfileFor("gemini-3.5-TRANSCRIBE-LIVE")).toBeNull();
  });

  it("finds listed models by ID, ignoring surrounding spaces", () => {
    expect(findGeminiModel(GEMINI_VOICE_MODELS, " gemini-3.8-live ")?.name).toBe("Gemini 3.8 Live");
    expect(findGeminiModel(GEMINI_RESPONSE_MODELS, "gemini-9")).toBeUndefined();
  });
});
