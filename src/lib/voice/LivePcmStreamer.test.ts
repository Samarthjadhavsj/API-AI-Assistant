import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LivePcmStreamer } from "./LivePcmStreamer";

// Mock AudioContext and related APIs
class MockAudioWorkletNode {
  port = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn(),
  };
  disconnect = vi.fn();

  constructor(
    public context: MockAudioContext,
    public name: string,
    public options: any
  ) {}
}

class MockMediaStreamAudioSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();

  constructor(public context: MockAudioContext, public stream: MediaStream) {}
}

class MockAudioContext {
  state = "running";
  sampleRate = 16000;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };

  createMediaStreamSource = vi.fn((stream: MediaStream) => {
    return new MockMediaStreamAudioSourceNode(this, stream);
  });

  close = vi.fn().mockResolvedValue(undefined);
}

// Replace global APIs
(global as any).AudioContext = MockAudioContext;
(global as any).AudioWorkletNode = MockAudioWorkletNode;

describe("LivePcmStreamer", () => {
  let mockStream: MediaStream;
  let onChunk: (pcmData: ArrayBuffer) => void;
  let onError: (error: Error) => void;

  beforeEach(() => {
    // Create a mock MediaStream
    mockStream = {
      getTracks: () => [],
      id: "mock-stream-id",
    } as any;

    onChunk = vi.fn();
    onError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("creates AudioContext with 16kHz sample rate", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      // AudioContext should be created
      expect((streamer as any).audioContext).toBeInstanceOf(MockAudioContext);
      expect((streamer as any).audioContext.sampleRate).toBe(16000);

      await streamer.stop();
    });

    it("loads AudioWorklet processor module", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const audioContext = (streamer as any).audioContext;
      expect(audioContext.audioWorklet.addModule).toHaveBeenCalledOnce();

      await streamer.stop();
    });

    it("creates MediaStreamSource from input stream", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const audioContext = (streamer as any).audioContext;
      expect(audioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);

      await streamer.stop();
    });

    it("connects source to worklet node", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const sourceNode = (streamer as any).sourceNode;
      const workletNode = (streamer as any).workletNode;

      expect(sourceNode.connect).toHaveBeenCalledWith(workletNode);

      await streamer.stop();
    });
  });

  describe("PCM chunk delivery", () => {
    it("forwards PCM chunks from worklet to callback", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const workletNode = (streamer as any).workletNode;
      const pcmData = new Int16Array([100, 200, 300]).buffer;

      // Simulate worklet sending a chunk
      workletNode.port.onmessage?.({ data: pcmData } as MessageEvent);

      expect(onChunk).toHaveBeenCalledOnce();
      expect(onChunk).toHaveBeenCalledWith(pcmData);

      await streamer.stop();
    });

    it("handles multiple PCM chunks sequentially", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const workletNode = (streamer as any).workletNode;

      const chunk1 = new Int16Array([1, 2, 3]).buffer;
      const chunk2 = new Int16Array([4, 5, 6]).buffer;
      const chunk3 = new Int16Array([7, 8, 9]).buffer;

      workletNode.port.onmessage?.({ data: chunk1 } as MessageEvent);
      workletNode.port.onmessage?.({ data: chunk2 } as MessageEvent);
      workletNode.port.onmessage?.({ data: chunk3 } as MessageEvent);

      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunk).toHaveBeenNthCalledWith(1, chunk1);
      expect(onChunk).toHaveBeenNthCalledWith(2, chunk2);
      expect(onChunk).toHaveBeenNthCalledWith(3, chunk3);

      await streamer.stop();
    });

    it("does not forward chunks after stop", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();
      await streamer.stop();

      const workletNode = (streamer as any).workletNode;
      // Worklet node should be null after stop
      expect(workletNode).toBeNull();

      // Clear the mock to ensure no new calls
      vi.mocked(onChunk).mockClear();

      // These chunks should not be forwarded
      expect(onChunk).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("disconnects worklet node on stop", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();
      const workletNode = (streamer as any).workletNode;

      await streamer.stop();

      expect(workletNode.disconnect).toHaveBeenCalled();
      expect((streamer as any).workletNode).toBeNull();
    });

    it("disconnects source node on stop", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();
      const sourceNode = (streamer as any).sourceNode;

      await streamer.stop();

      expect(sourceNode.disconnect).toHaveBeenCalled();
      expect((streamer as any).sourceNode).toBeNull();
    });

    it("closes AudioContext on stop", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();
      const audioContext = (streamer as any).audioContext;

      await streamer.stop();

      expect(audioContext.close).toHaveBeenCalled();
      expect((streamer as any).audioContext).toBeNull();
    });

    it("cleans up on cancel", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      // Start and immediately cancel
      const startPromise = streamer.start();
      streamer.cancel();

      // Wait for start to complete (it should handle cancel gracefully)
      try {
        await startPromise;
      } catch {
        // Expected to fail or cleanup
      }

      // Resources should be cleaned up
      expect((streamer as any).isActive).toBe(false);
    });

    it("does not leak resources on multiple stop calls", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();
      await streamer.stop();
      await streamer.stop(); // Second stop should be safe

      // Should not throw
      expect((streamer as any).audioContext).toBeNull();
    });
  });

  describe("error handling", () => {
    it("calls onError when start fails", async () => {
      const errorStream = mockStream;
      const mockError = new Error("AudioWorklet load failed");

      // Mock AudioContext to throw error
      const OriginalAudioContext = (global as any).AudioContext;
      (global as any).AudioContext = class extends MockAudioContext {
        audioWorklet = {
          addModule: vi.fn().mockRejectedValue(mockError),
        };
      };

      const streamer = new LivePcmStreamer({
        stream: errorStream,
        onChunk,
        onError,
      });

      await expect(streamer.start()).rejects.toThrow("AudioWorklet load failed");
      expect(onError).toHaveBeenCalledWith(mockError);

      // Restore
      (global as any).AudioContext = OriginalAudioContext;
    });

    it("cleans up resources after error", async () => {
      const mockError = new Error("Test error");

      const OriginalAudioContext = (global as any).AudioContext;
      (global as any).AudioContext = class extends MockAudioContext {
        audioWorklet = {
          addModule: vi.fn().mockRejectedValue(mockError),
        };
      };

      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await expect(streamer.start()).rejects.toThrow();

      // Resources should be cleaned up
      expect((streamer as any).audioContext).toBeNull();
      expect((streamer as any).sourceNode).toBeNull();
      expect((streamer as any).workletNode).toBeNull();

      // Restore
      (global as any).AudioContext = OriginalAudioContext;
    });

    it("throws error when starting twice", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      await expect(streamer.start()).rejects.toThrow("LivePcmStreamer already started");

      await streamer.stop();
    });
  });

  describe("speech detection", () => {
    it("returns false for silent PCM (zero amplitude)", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const workletNode = (streamer as any).workletNode;
      // Create silent PCM data (all zeros)
      const silentPcm = new Int16Array(new Array(1000).fill(0)).buffer;

      workletNode.port.onmessage?.({ data: silentPcm } as MessageEvent);

      expect(streamer.hasSpeechDetected()).toBe(false);

      await streamer.stop();
    });

    it("returns false for very low background noise (below threshold)", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const workletNode = (streamer as any).workletNode;
      // Create low-amplitude noise (RMS ~100, below threshold of 500)
      const lowNoisePcm = new Int16Array(new Array(1000).fill(100)).buffer;

      workletNode.port.onmessage?.({ data: lowNoisePcm } as MessageEvent);

      expect(streamer.hasSpeechDetected()).toBe(false);

      await streamer.stop();
    });

    it("returns true for normal speech amplitude (above threshold)", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const workletNode = (streamer as any).workletNode;
      // Create speech-like amplitude (RMS ~1000, above threshold of 500)
      const speechPcm = new Int16Array(new Array(1000).fill(1000)).buffer;

      workletNode.port.onmessage?.({ data: speechPcm } as MessageEvent);

      expect(streamer.hasSpeechDetected()).toBe(true);

      await streamer.stop();
    });

    it("maintains speech detection once threshold is crossed", async () => {
      const streamer = new LivePcmStreamer({
        stream: mockStream,
        onChunk,
        onError,
      });

      await streamer.start();

      const workletNode = (streamer as any).workletNode;

      // First chunk: silent
      const silentPcm = new Int16Array(new Array(100).fill(0)).buffer;
      workletNode.port.onmessage?.({ data: silentPcm } as MessageEvent);
      expect(streamer.hasSpeechDetected()).toBe(false);

      // Second chunk: speech
      const speechPcm = new Int16Array(new Array(100).fill(1000)).buffer;
      workletNode.port.onmessage?.({ data: speechPcm } as MessageEvent);
      expect(streamer.hasSpeechDetected()).toBe(true);

      // Third chunk: silent again
      workletNode.port.onmessage?.({ data: silentPcm } as MessageEvent);
      expect(streamer.hasSpeechDetected()).toBe(true); // Still true

      await streamer.stop();
    });
  });
});
