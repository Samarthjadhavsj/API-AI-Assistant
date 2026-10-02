import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceRecorderController } from "./VoiceRecorderController";
import { GeminiLiveSttAdapter } from "@/lib/stt/GeminiLiveSttAdapter";

/**
 * Live voice with the real controller, engine, PCM streamer and Gemini Live
 * adapter; only the browser APIs are fake. When the recorder can't start (the
 * worklet fails to load), the Gemini WebSocket opened for the session must be
 * closed and every audio resource released.
 */

const TEST_KEY = "test-live-key-not-real";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  send(data: string) {
    this.sent.push(data);
  }
}

/** How the next AudioContext's addModule() behaves. */
let loadWorklet: () => Promise<void>;
const contexts: FakeAudioContext[] = [];
const workletNodes: FakeAudioWorkletNode[] = [];

class FakeAudioContext {
  state: AudioContextState = "running";
  audioWorklet = { addModule: vi.fn(() => loadWorklet()) };
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
  close = vi.fn(async () => {
    this.state = "closed";
  });
  constructor() {
    contexts.push(this);
  }
}

class FakeAudioWorkletNode {
  port = { onmessage: null as ((event: MessageEvent) => void) | null };
  disconnect = vi.fn();
  constructor() {
    workletNodes.push(this);
  }
}

const WORKLET_LOAD_ERROR = () =>
  Promise.reject(new DOMException("Unable to load a worklet's module.", "AbortError"));

function fakeMicrophone() {
  const track = {
    id: "mic",
    kind: "audio",
    readyState: "live" as MediaStreamTrackState,
    stop: vi.fn(() => {
      track.readyState = "ended";
    }),
  };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

/** A controller whose every session gets its own fake microphone. */
function voiceController() {
  const mics: ReturnType<typeof fakeMicrophone>[] = [];
  const controller = new VoiceRecorderController({
    request: async () => {
      const mic = fakeMicrophone();
      mics.push(mic);
      return mic.stream;
    },
  });
  const start = () =>
    controller.start({
      adapter: new GeminiLiveSttAdapter("gemini-transcribe", {
        api_key: TEST_KEY,
        model: "gemini-3.5-transcribe-live",
      }),
      ownerId: "test",
    });
  return { controller, mics, start };
}

function startSession() {
  const { controller, mics, start } = voiceController();
  const started = start();
  return { controller, started, get mic() { return mics[0]; } };
}

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  FakeWebSocket.instances = [];
  contexts.length = 0;
  workletNodes.length = 0;
  unhandled.length = 0;
  loadWorklet = () => Promise.resolve();
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
  process.on("unhandledRejection", onUnhandled);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Lets pending promise callbacks and timers run (unhandled rejections surface here too). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("live voice: recorder startup failure", () => {
  it("closes the open Gemini WebSocket and releases every audio resource", async () => {
    let failLoad!: () => void;
    loadWorklet = () => new Promise((_, reject) => (failLoad = () => reject(new DOMException("Unable to load a worklet's module.", "AbortError"))));
    const { controller, mic, started } = startSession();
    await started;

    // The session's WebSocket is open and set up before the worklet finishes loading.
    const [socket] = FakeWebSocket.instances;
    socket.open();
    expect(socket.sent.map((message) => Object.keys(JSON.parse(message))[0])).toEqual(["setup"]);

    failLoad();
    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe("error"));
    await settle();

    expect(controller.getSnapshot().error?.code).toBe("recorder_failed");
    expect(socket.close).toHaveBeenCalled();
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    // No audio went out: only the setup message.
    expect(socket.sent).toHaveLength(1);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(workletNodes).toHaveLength(0);
    expect(mic.track.stop).toHaveBeenCalled();
    expect(mic.track.readyState).toBe("ended");
    expect(controller.getSnapshot().stream).toBeNull();
    expect(unhandled).toEqual([]);
  });

  it("closes a WebSocket that is still connecting when the worklet fails", async () => {
    loadWorklet = WORKLET_LOAD_ERROR;
    const { controller, mic, started } = startSession();
    await started;

    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe("error"));
    await settle();

    const [socket] = FakeWebSocket.instances;
    expect(socket.close).toHaveBeenCalled();
    expect(socket.sent).toEqual([]);
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(mic.track.stop).toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });

  it("leaves nothing behind: late events on the failed socket change nothing, and voice starts again", async () => {
    loadWorklet = WORKLET_LOAD_ERROR;
    const { controller, mics, start } = voiceController();
    await start();
    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe("error"));
    await settle();

    // A late transcript or close on the failed session's socket is ignored.
    const [failedSocket] = FakeWebSocket.instances;
    const afterFailure = controller.getSnapshot();
    failedSocket.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ serverContent: { inputTranscription: { text: "late" } } }),
      })
    );
    failedSocket.onclose?.(new CloseEvent("close", { code: 1000 }));
    await settle();
    expect(controller.getSnapshot()).toBe(afterFailure);

    // The same controller records again once the worklet loads, with fresh resources.
    loadWorklet = () => Promise.resolve();
    expect(await start()).toBe(true);
    await vi.waitFor(() => expect(workletNodes).toHaveLength(1));
    expect(controller.getSnapshot().state).toBe("recording");
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(contexts).toHaveLength(2);

    // Cancelling that session releases it too.
    controller.cancel("test");
    await settle();
    expect(FakeWebSocket.instances[1].close).toHaveBeenCalled();
    expect(contexts[1].close).toHaveBeenCalledOnce();
    expect(workletNodes[0].disconnect).toHaveBeenCalled();
    expect(workletNodes[0].port.onmessage).toBeNull();
    expect(mics.map((mic) => mic.track.readyState)).toEqual(["ended", "ended"]);
    expect(unhandled).toEqual([]);
  });

  it("never exposes the API key in logs", async () => {
    loadWorklet = WORKLET_LOAD_ERROR;
    const { controller, started } = startSession();
    await started;
    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe("error"));
    await settle();

    const describe = (arg: unknown) => {
      if (arg instanceof Error) return `${arg.name} ${arg.message}`;
      try {
        return typeof arg === "string" ? arg : JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    };
    const logged = [console.log, console.error]
      .flatMap((fn) => vi.mocked(fn).mock.calls)
      .map((args) => args.map(describe).join(" "));
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.join("\n")).not.toContain(TEST_KEY);
  });
});
