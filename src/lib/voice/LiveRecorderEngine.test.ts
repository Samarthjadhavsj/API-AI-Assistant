import { describe, expect, it, vi } from "vitest";
import { LiveRecorderEngine } from "./LiveRecorderEngine";
import { SttAdapter } from "./types";

const mockedStreamer = vi.hoisted(() => ({ start: vi.fn(async () => undefined) }));

vi.mock("./LivePcmStreamer", () => ({
  LivePcmStreamer: class {
    start = mockedStreamer.start;
    async stop() {}
    cancel() {}
    hasSpeechDetected() {
      return true;
    }
  },
}));

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
});
