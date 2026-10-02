import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config";
import { responseLanguageName, TranslationError, translateText } from "./translate.function";

const KEY = "AIza-translate-secret";
const TRANSCRIPT = "Hola, ¿cómo estás? Quiero saber el tiempo en Madrid.";

let fetchMock: ReturnType<typeof vi.fn>;
const ok = (text: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
});
/** The saved Responses settings (the test setup's localStorage is a mock). */
const saveResponseSettings = (settings: object | null) =>
  vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
    key === STORAGE_KEYS.RESPONSE_SETTINGS && settings ? JSON.stringify(settings) : null
  );
beforeEach(() => {
  fetchMock = vi.fn(async () => ok("  Hello, how are you? I want to know the weather in Madrid.\n"));
  vi.stubGlobal("fetch", fetchMock);
  saveResponseSettings(null);
});
afterEach(() => vi.unstubAllGlobals());

const sent = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: String(url), init, body: JSON.parse(init.body) };
};

describe("translateText", () => {
  it("sends ONE lightweight request to Gemini 3.5 Flash Lite with the voice key in a header", async () => {
    const translated = await translateText({ text: TRANSCRIPT, targetLanguage: "English", apiKey: KEY });

    expect(translated).toBe("Hello, how are you? I want to know the weather in Madrid.");
    expect(fetchMock).toHaveBeenCalledOnce();
    const { url, init, body } = sent();
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect(url).not.toContain(KEY);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", "x-goog-api-key": KEY });
    // The transcript as-is, the target language in the instruction, nothing else
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: TRANSCRIPT }] }]);
    expect(body.systemInstruction.parts[0].text).toMatch(/^Translate the user's text into English\. Reply with the translation only/);
    expect(body.generationConfig).toEqual({ temperature: 0 });
    expect(Object.keys(body).sort()).toEqual(["contents", "generationConfig", "systemInstruction"]);
  });

  it.each([
    [400, "Translation was refused. Check the Gemini API key in Settings → Voice Transcription."],
    [403, "Translation was refused. Check the Gemini API key in Settings → Voice Transcription."],
    [429, "Translation is rate-limited right now. Try again in a moment."],
    [503, "Translation failed (503). Try again."],
  ])("HTTP %s → a clear error, with no key or transcript in it", async (status, message) => {
    fetchMock.mockResolvedValueOnce({ ok: false, status, json: async () => ({ error: { message: `bad key ${KEY}` } }) });

    const error = await translateText({ text: TRANSCRIPT, targetLanguage: "English", apiKey: KEY }).catch((e) => e);

    expect(error).toBeInstanceOf(TranslationError);
    expect(error.message).toBe(message);
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain("Madrid");
  });

  it("a network failure or an empty answer is a TranslationError too", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(translateText({ text: TRANSCRIPT, targetLanguage: "English", apiKey: KEY })).rejects.toThrow(
      "Couldn't reach the translation service. Check your connection and try again."
    );

    fetchMock.mockResolvedValueOnce(ok("   "));
    await expect(translateText({ text: TRANSCRIPT, targetLanguage: "English", apiKey: KEY })).rejects.toThrow(
      "Translation came back empty. Try again."
    );
  });

  it("without a key, nothing is sent", async () => {
    await expect(translateText({ text: TRANSCRIPT, targetLanguage: "English", apiKey: " " })).rejects.toThrow(
      TranslationError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("responseLanguageName (Toggle Settings → Responses → Language)", () => {
  it("uses the configured Responses language", () => {
    saveResponseSettings({ responseLength: "auto", language: "spanish", autoScroll: true });
    expect(responseLanguageName()).toBe("Spanish");
  });

  it("falls back to the app's default language when unset or unknown", () => {
    expect(responseLanguageName()).toBe("English");
    saveResponseSettings({ language: "klingon" });
    expect(responseLanguageName()).toBe("English");
  });
});
