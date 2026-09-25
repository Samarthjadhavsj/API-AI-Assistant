import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { createSttAdapter } from "./sttAdapterFactory";
import { MultipartSttAdapter } from "./MultipartSttAdapter";
import { GeminiLiveSttAdapter } from "./GeminiLiveSttAdapter";
import type { AudioArtifact } from "@/lib/voice/types";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
// The browser decodes the recording in the app; here the WAV step is stubbed.
vi.mock("@/lib/voice/wav", () => ({
  recordingToWav: vi.fn(async () => new Blob(["RIFF-WAV"], { type: "audio/wav" })),
}));

const tauriFetchMock = vi.mocked(tauriFetch);

const artifact: AudioArtifact = {
  blob: new Blob(["webm-audio"], { type: "audio/webm" }),
  mimeType: "audio/webm",
  durationMs: 1200,
  sizeBytes: 10,
  deviceId: null,
  chunkCount: 1,
};

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

/** Builds the adapter voice input would use for this saved selection. */
const adapterFor = (provider: string, variables: Record<string, string>) =>
  createSttAdapter({ id: provider, curl: "" }, { provider, variables });

const transcribe = (adapter: ReturnType<typeof adapterFor>, signal = new AbortController().signal) =>
  adapter!.transcribe(artifact, { signal });

/** What was sent: URL, headers and the multipart fields. */
const sent = (mock: ReturnType<typeof vi.fn>) => {
  const [url, init] = mock.mock.calls[mock.mock.calls.length - 1] as [string, RequestInit];
  const form = init.body as FormData;
  const file = form.get("file") as File;
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    fields: Object.fromEntries([...form.entries()].filter(([k]) => k !== "file")),
    fileName: file.name,
    fileType: file.type,
  };
};

beforeEach(() => {
  tauriFetchMock.mockReset();
  tauriFetchMock.mockResolvedValue(jsonResponse(200, { text: "  hello from the provider  " }));
});

afterEach(() => vi.unstubAllGlobals());

describe("voice input reaches the selected provider", () => {
  it.each([
    ["openai", "https://api.openai.com/v1/audio/transcriptions", "gpt-transcribe"],
    ["grok", "https://api.x.ai/v1/stt", "grok-voice-transcribe-2.0"],
    ["mistral", "https://api.mistral.ai/v1/audio/transcriptions", "voxtral-mini-latest"],
    ["groq", "https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3-turbo"],
    ["openrouter", "https://openrouter.ai/api/v1/audio/transcriptions", "openai/whisper-1"],
  ])("%s: uploads the recording as WAV to its endpoint with its model and key", async (provider, endpoint, model) => {
    const adapter = adapterFor(provider, { api_key: `${provider}-key`, model });
    expect(adapter).toBeInstanceOf(MultipartSttAdapter);

    const result = await transcribe(adapter);

    expect(result).toEqual({ text: "hello from the provider", providerId: provider });
    expect(sent(tauriFetchMock)).toEqual({
      url: endpoint,
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${provider}-key` },
      fields: { model },
      fileName: "recording.wav",
      fileType: "audio/wav",
    });
  });

  it("cohere: also sends the required language", async () => {
    const adapter = adapterFor("cohere", { api_key: "co-key", model: "cohere-transcribe-03-2026", language: "en" });

    await transcribe(adapter);

    expect(sent(tauriFetchMock)).toMatchObject({
      url: "https://api.cohere.com/v2/audio/transcriptions",
      fields: { model: "cohere-transcribe-03-2026", language: "en" },
    });
  });

  it("custom: uses its own endpoint, model, optional key and transcript field", async () => {
    const windowFetch = vi.fn(async () => jsonResponse(200, { result: { transcript: "local words" } }));
    vi.stubGlobal("fetch", windowFetch);
    const adapter = adapterFor("custom", {
      name: "My Whisper",
      endpoint: "http://localhost:9000/v1/audio/transcriptions",
      model: "small.en",
      response_path: "result.transcript",
    });

    const result = await transcribe(adapter);

    expect(result.text).toBe("local words");
    // A local server goes through the WebView's fetch (the app's HTTP scope
    // doesn't cover explicit ports), like the rest of the app
    expect(tauriFetchMock).not.toHaveBeenCalled();
    expect(sent(windowFetch)).toEqual({
      url: "http://localhost:9000/v1/audio/transcriptions",
      method: "POST",
      headers: { Accept: "application/json" },
      fields: { model: "small.en" },
      fileName: "recording.wav",
      fileType: "audio/wav",
    });
  });

  it("custom: a remote endpoint with a key goes through Tauri with the key", async () => {
    const adapter = adapterFor("custom", {
      endpoint: "https://stt.example.com/v1/transcribe",
      model: "m",
      api_key: "custom-key",
    });

    await transcribe(adapter);

    expect(sent(tauriFetchMock)).toMatchObject({
      url: "https://stt.example.com/v1/transcribe",
      headers: { Authorization: "Bearer custom-key" },
    });
  });
});

describe("which HTTP client is used", () => {
  it("an address outside the app's HTTP scope falls back to the WebView's fetch", async () => {
    tauriFetchMock.mockRejectedValue("url not allowed on the configured scope: https://stt.example.com:8443/x");
    const windowFetch = vi.fn(async () => jsonResponse(200, { text: "via webview" }));
    vi.stubGlobal("fetch", windowFetch);

    const result = await transcribe(adapterFor("custom", { endpoint: "https://stt.example.com:8443/x", model: "m" }));

    expect(result.text).toBe("via webview");
    expect(sent(windowFetch).url).toBe("https://stt.example.com:8443/x");
  });

  it("a local server that can't be reached says to check it's running and allows CORS", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    const error = await transcribe(adapterFor("custom", { endpoint: "http://localhost:9000/stt", model: "m", name: "My Whisper" })).catch((e) => e);

    expect(error.message).toBe(
      "Couldn't reach My Whisper. Check that the server is running and allows requests from the app (CORS)."
    );
  });
});

describe("no adapter when the provider can't be used (never Gemini instead)", () => {
  it.each(["claude", "perplexity", "ollama", "deepseek"])("%s has no speech-to-text", (provider) => {
    expect(adapterFor(provider, { api_key: "k", model: "m" })).toBeNull();
  });

  it("an incomplete setup gets no adapter", () => {
    expect(adapterFor("openai", { model: "gpt-transcribe" })).toBeNull();
    expect(adapterFor("cohere", { api_key: "k", model: "m" })).toBeNull();
    expect(adapterFor("custom", { model: "m" })).toBeNull();
  });

  it("Gemini Voice still gets its own adapter", () => {
    const adapter = createSttAdapter(
      { id: "gemini-transcribe", curl: "" },
      { provider: "gemini-transcribe", variables: { api_key: "g", model: "gemini-3.5-transcribe-live" } }
    );
    expect(adapter).toBeInstanceOf(GeminiLiveSttAdapter);
  });
});

describe("errors are clear and never include the key", () => {
  it("a rejected key", async () => {
    tauriFetchMock.mockResolvedValue(jsonResponse(401, { error: { message: "Incorrect API key provided" } }));
    const adapter = adapterFor("openai", { api_key: "sk-secret-123", model: "gpt-transcribe" });

    const error = await transcribe(adapter).catch((e) => e);

    expect(error).toMatchObject({
      code: "stt_request_failed",
      message: "OpenAI rejected the API key (401): Incorrect API key provided",
    });
    expect(JSON.stringify(error.message)).not.toContain("sk-secret-123");
  });

  it("hides a key the provider echoes back, masked or in full", async () => {
    tauriFetchMock.mockResolvedValue(
      jsonResponse(401, { error: { message: "Incorrect API key provided: sk-secr********-123. Also sk-secret-123." } })
    );
    const adapter = adapterFor("openai", { api_key: "sk-secret-123", model: "gpt-transcribe" });

    const error = await transcribe(adapter).catch((e) => e);

    expect(error.message).toBe("OpenAI rejected the API key (401): Incorrect API key provided: [hidden] Also [hidden].");
    expect(error.message).not.toMatch(/sk-secr/);
  });

  it("a quota error", async () => {
    tauriFetchMock.mockResolvedValue(jsonResponse(429, { error: { message: "Rate limit" } }));
    const error = await transcribe(adapterFor("groq", { api_key: "k", model: "m" })).catch((e) => e);
    expect(error.message).toBe("Groq rate limit or quota reached (429): Rate limit");
  });

  it("a network failure", async () => {
    tauriFetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await transcribe(adapterFor("mistral", { api_key: "k", model: "m" })).catch((e) => e);
    expect(error).toMatchObject({
      code: "stt_request_failed",
      message: "Couldn't reach Mistral. Check your connection and the endpoint.",
    });
  });

  it("a response without a transcript", async () => {
    tauriFetchMock.mockResolvedValue(jsonResponse(200, { segments: [] }));
    const error = await transcribe(adapterFor("grok", { api_key: "k", model: "m" })).catch((e) => e);
    expect(error.code).toBe("provider_returned_no_text");
  });

  it("a cancelled transcription", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await transcribe(adapterFor("openai", { api_key: "k", model: "m" }), controller.signal).catch((e) => e);
    expect(error.name).toBe("AbortError");
    expect(tauriFetchMock).not.toHaveBeenCalled();
  });
});
