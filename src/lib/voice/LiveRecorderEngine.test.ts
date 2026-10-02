import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveRecorderEngine } from "./LiveRecorderEngine";
import { SttAdapter } from "./types";

const mockedStreamer = vi.hoisted(() => ({
  start: vi.fn(async () => undefined),
  cancel: vi.fn(),
  options: null as null | { onError: (error: Error) => void },
}));

vi.mock("./LivePcmStreamer", () => ({
  LivePcmStreamer: class {
    constructor(options: { onError: (error: Error) => void }) {
      mockedStreamer.options = options;
    }
    start = mockedStreamer.start;
    async stop() {}
    cancel = mockedStreamer.cancel;
    hasSpeechDetected() {
      return true;
    }
  },
}));

afterEach(() => {
  mockedStreamer.start.mockReset().mockImplementation(async () => undefined);
  mockedStreamer.cancel.mockReset();
  vi.restoreAllMocks();
});

/** A live adapter whose transcription stays open until aborted, like a WebSocket session. */
function liveAdapter() {
  let signal: AbortSignal | undefined;
  const adapter: SttAdapter & { kind: "live-websocket" } = {
    kind: "live-websocket",
    providerId: "gemini",
    transcribe: vi.fn((_artifact, options) => {
      signal = options.signal;
      return new Promise<never>((_, reject) =>
        options.signal.addEventListener("abort", () =>
          reject(new DOMException("Transcription cancelled.", "AbortError"))
        )
      );
    }),
  };
  return { adapter, signal: () => signal };
}

describe("LiveRecorderEngine", () => {
  it("forwards adapter partial transcripts to its callback", () => {
    const onPartial = vi.fn();
    const adapter: SttAdapter & { kind: "live-websocket" } = {
      kind: "live-websocket",
      providerId: "gemini",
      transcribe: vi.fn(async (_artifact, options) => {
        options.onPartial?.("live words");
        return { text: "live words", providerId: "gemini" };
      }),
    };
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const engine = new LiveRecorderEngine({
      stream,
      deviceId: null,
      adapter,
      onFailure: vi.fn(),
      onPartial,
    });

    engine.start();

    expect(onPartial).toHaveBeenCalledWith("live words");
  });

  it("a streamer that fails to start aborts the live session and reports the failure once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new DOMException("Unable to load a worklet's module.", "AbortError");
    mockedStreamer.start.mockImplementation(async () => {
      // Like LivePcmStreamer: reports through onError, then rejects.
      mockedStreamer.options!.onError(failure as unknown as Error);
      throw failure;
    });
    const { adapter, signal } = liveAdapter();
    const onFailure = vi.fn();
    const engine = new LiveRecorderEngine({
      stream: { getTracks: () => [] } as unknown as MediaStream,
      deviceId: null,
      adapter,
      onFailure,
    });

    engine.start();
    await vi.waitFor(() => expect(onFailure).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(failure);
    expect(signal()?.aborted).toBe(true);
    expect(mockedStreamer.cancel).toHaveBeenCalledOnce();
    // Nothing left to stop or cancel.
    await expect(engine.stop()).resolves.toBeNull();
    await engine.cancel();
    expect(mockedStreamer.cancel).toHaveBeenCalledOnce();
  });

  it("cancel() aborts the live session and stops the streamer", async () => {
    const { adapter, signal } = liveAdapter();
    const engine = new LiveRecorderEngine({
      stream: { getTracks: () => [] } as unknown as MediaStream,
      deviceId: null,
      adapter,
      onFailure: vi.fn(),
    });

    engine.start();
    await engine.cancel();

    expect(signal()?.aborted).toBe(true);
    expect(mockedStreamer.cancel).toHaveBeenCalledOnce();
  });
});
