import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiLiveSttAdapter } from "./GeminiLiveSttAdapter";
import type { AudioArtifact } from "@/lib/voice/types";

/** WebSocket stand-in that opens on the next microtask (works with fake timers). */
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: Event) => void) | null = null;
  sent: any[] = [];

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.(new Event("open"));
    });
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  /** A message from Gemini. */
  receive(message: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(message) }));
  }
  /** Gemini closing the connection. */
  serverClose(code: number, reason: string) {
    this.readyState = 3;
    this.onclose?.(Object.assign(new Event("close"), { code, reason }));
  }
  /** What was sent, in order, with audio data reduced to its size. */
  kinds() {
    return this.sent.map((m) =>
      m.setup
        ? "setup"
        : m.realtimeInput?.audio
          ? `audio:${atob(m.realtimeInput.audio.data).length}`
          : Object.keys(m.realtimeInput ?? {})[0]
    );
  }
}

const artifact: AudioArtifact = {
  // jsdom's Blob has no arrayBuffer(); the WebView's does.
  blob: Object.assign(new Blob([], { type: "audio/pcm" }), {
    arrayBuffer: async () => new ArrayBuffer(0),
  }),
  mimeType: "audio/pcm;rate=16000",
  durationMs: 0,
  sizeBytes: 0,
  deviceId: null,
  sampleRate: 16000,
  chunkCount: 0,
};

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
};

/** Starts a live session for a model; returns the adapter, socket and result promise. */
const start = async (model: string) => {
  const adapter = new GeminiLiveSttAdapter("gemini-transcribe", { api_key: "k", model });
  const onPartial = vi.fn();
  const result = adapter.transcribe(artifact, { signal: new AbortController().signal, onPartial });
  result.catch(() => {}); // asserted explicitly where it matters
  await flush();
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  return { adapter, ws, result, onPartial };
};

const chunk = (bytes: number) => new ArrayBuffer(bytes);

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("setup per voice model", () => {
  it.each([
    ["gemini-2.5-flash-native-audio-preview-12-2025", "AUDIO"],
    ["gemini-3.1-flash-live-preview", "AUDIO"],
    ["gemini-3.8-live", "AUDIO"],
    ["gemini-3.5-live-translate-preview", "TEXT"],
  ])("%s: %s responses, speech start/end marked explicitly", async (model, modality) => {
    const { ws } = await start(model);

    expect(ws.sent[0]).toEqual({
      setup: {
        model: `models/${model}`,
        generationConfig: { responseModalities: [modality] },
        inputAudioTranscription: {},
        realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
      },
    });
  });

  it("gemini-3.8-live-extended-thinking: sets the required thinking level", async () => {
    const { ws } = await start("gemini-3.8-live-extended-thinking");

    expect(ws.sent[0].setup.generationConfig).toEqual({
      responseModalities: ["AUDIO"],
      thinkingConfig: { thinkingLevel: "low" },
    });
  });

  it("gemini-3.5-transcribe-live: unchanged text setup with Gemini's own voice detection", async () => {
    const { ws } = await start("gemini-3.5-transcribe-live");

    expect(ws.sent[0]).toEqual({
      setup: {
        model: "models/gemini-3.5-transcribe-live",
        generationConfig: { responseModalities: ["TEXT"] },
        inputAudioTranscription: {},
      },
    });
  });
});

describe("stream models", () => {
  it("hold audio until setup completes, then mark speech start and send it in order", async () => {
    const { adapter, ws } = await start("gemini-3.8-live");

    adapter.sendAudioChunk(chunk(100));
    adapter.sendAudioChunk(chunk(200));
    expect(ws.kinds()).toEqual(["setup"]);

    ws.receive({ setupComplete: {} });
    adapter.sendAudioChunk(chunk(300));

    expect(ws.kinds()).toEqual(["setup", "activityStart", "audio:100", "audio:200", "audio:300"]);
  });

  it("append transcript pieces as sent and finish once they stop arriving", async () => {
    const { adapter, ws, result, onPartial } = await start("gemini-2.5-flash-native-audio-preview-12-2025");
    ws.receive({ setupComplete: {} });
    adapter.sendAudioChunk(chunk(3200));

    for (const text of [" What", " co", "lor", " is"]) ws.receive({ serverContent: { inputTranscription: { text } } });
    adapter.sendAudioStreamEnd();
    await flush();
    ws.receive({ serverContent: { inputTranscription: { text: " the circle?" } } });

    expect(onPartial.mock.calls.map(([t]) => t)).toEqual([
      "What",
      "What co",
      "What color",
      "What color is",
      "What color is the circle?",
    ]);
    // Speech end is marked explicitly, not with audioStreamEnd
    expect(ws.kinds().slice(-1)).toEqual(["activityEnd"]);

    let settled = false;
    result.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(1400);
    expect(settled).toBe(false); // still within the 1.5 s settle window
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toEqual({ text: "What color is the circle?", providerId: "gemini-transcribe" });
  });

  it("finish immediately when Gemini completes the turn", async () => {
    const { adapter, ws, result } = await start("gemini-3.8-live");
    ws.receive({ setupComplete: {} });
    adapter.sendAudioChunk(chunk(3200));
    adapter.sendAudioStreamEnd();
    await flush();

    ws.receive({ serverContent: { inputTranscription: { text: "Summarize this page." } } });
    ws.receive({ serverContent: { modelTurn: { parts: [{ inlineData: { data: "AAAA" } }] } } });
    ws.receive({ serverContent: { turnComplete: true } });

    await expect(result).resolves.toEqual({ text: "Summarize this page.", providerId: "gemini-transcribe" });
  });

  it("send the end once setup completes when Done is tapped before that", async () => {
    const { adapter, ws, result } = await start("gemini-3.8-live");
    adapter.sendAudioChunk(chunk(640));
    adapter.sendAudioStreamEnd();
    expect(ws.kinds()).toEqual(["setup"]);

    ws.receive({ setupComplete: {} });
    await flush();
    expect(ws.kinds()).toEqual(["setup", "activityStart", "audio:640", "activityEnd"]);

    ws.receive({ serverContent: { inputTranscription: { text: "Hi" } } });
    await vi.advanceTimersByTimeAsync(600);
    await expect(result).resolves.toMatchObject({ text: "Hi" });
  });

  it("Live Translate streams trailing silence in real time before ending", async () => {
    const { adapter, ws } = await start("gemini-3.5-live-translate-preview");
    ws.receive({ setupComplete: {} });
    adapter.sendAudioChunk(chunk(3200));
    adapter.sendAudioStreamEnd();
    await flush();

    await vi.advanceTimersByTimeAsync(500);
    expect(ws.kinds().filter((k) => k === "audio:3200").length).toBeLessThan(12);
    expect(ws.kinds()).not.toContain("activityEnd");

    await vi.advanceTimersByTimeAsync(800);
    const kinds = ws.kinds();
    // 1 speech chunk + 12 × 100 ms of silence, then the end
    expect(kinds.filter((k) => k === "audio:3200")).toHaveLength(13);
    expect(kinds[kinds.length - 1]).toBe("activityEnd");
  });

  it("report no speech if no transcript ever arrives", async () => {
    const { adapter, ws, result } = await start("gemini-3.8-live");
    ws.receive({ setupComplete: {} });
    adapter.sendAudioChunk(chunk(3200));
    adapter.sendAudioStreamEnd();
    await flush();

    await vi.advanceTimersByTimeAsync(12_000);
    await expect(result).rejects.toThrow();
  });
});

describe("setup rejected by Gemini", () => {
  it("explains an unavailable model instead of reporting no speech", async () => {
    const { ws, result } = await start("gemini-3-flash-live");

    ws.serverClose(1008, "models/gemini-3-flash-live is not found for API version v1beta, or is not supported for bidiGenerateContent.");

    await expect(result).rejects.toThrow(
      'The voice model "gemini-3-flash-live" isn\'t available for this API key. Choose another model in Settings.'
    );
  });

  it("explains a quota error", async () => {
    const { ws, result } = await start("gemini-3.5-transcribe-live");

    ws.serverClose(1011, "RESOURCE_EXHAUSTED: You exceeded your current quota");

    await expect(result).rejects.toThrow("Voice transcription quota exceeded. Try again later.");
  });
});
