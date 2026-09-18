import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiLiveSttAdapter } from "./GeminiLiveSttAdapter";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);

    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.(new Event("open"));
    }, 10);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = 3; // CLOSED
    this.onclose?.(new Event("close"));
  }

  simulateMessage(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  simulateMessageBlob(data: string): void {
    // Create a proper Blob with text() method
    const blob = new Blob([data], { type: 'application/json' });
    // Ensure the blob has the text() method
    if (!blob.text) {
      (blob as any).text = async () => data;
    }
    this.onmessage?.(new MessageEvent("message", { data: blob }));
  }

  simulateMessageArrayBuffer(data: string): void {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(data);
    // Pass the actual ArrayBuffer
    this.onmessage?.(new MessageEvent("message", { data: uint8Array.buffer }));
  }

  simulateError(error: Event): void {
    this.onerror?.(error);
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }
}

// @ts-ignore - Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any;

describe("GeminiLiveSttAdapter", () => {
  let adapter: GeminiLiveSttAdapter;
  const mockApiKey = "test-api-key-12345";
  const mockModel = "gemini-3.5-transcribe-live";

  beforeEach(() => {
    MockWebSocket.reset();
    adapter = new GeminiLiveSttAdapter("gemini-transcribe", {
      api_key: mockApiKey,
      model: mockModel,
    });
  });

  afterEach(() => {
    adapter.close();
    MockWebSocket.reset();
  });

  describe("setup message", () => {
    it("creates correct setup message structure", () => {
      // Access private method via prototype for testing
      const setupMessage = (adapter as any).createSetupMessage();

      expect(setupMessage).toEqual({
        setup: {
          model: `models/${mockModel}`,
          generationConfig: {
            responseModalities: ["TEXT"],
          },
          inputAudioTranscription: {},
        },
      });
    });

    it("uses default model when none provided", () => {
      const defaultAdapter = new GeminiLiveSttAdapter("gemini-transcribe", {
        api_key: mockApiKey,
      });
      const setupMessage = (defaultAdapter as any).createSetupMessage();

      expect(setupMessage.setup.model).toBe("models/gemini-3.5-transcribe-live");
    });
  });

  describe("audio message formatting", () => {
    it("outgoing audio message uses realtimeInput.audio.data/mimeType", () => {
      const audioData = new ArrayBuffer(100);
      const audioMessage = (adapter as any).createAudioMessage(audioData);

      expect(audioMessage.realtimeInput).toBeDefined();
      expect(audioMessage.realtimeInput.audio).toBeDefined();
      expect(audioMessage.realtimeInput.audio.mimeType).toBe("audio/pcm;rate=16000");
      expect(audioMessage.realtimeInput.audio.data).toBeDefined();
    });

    it("converts ArrayBuffer to base64 correctly", () => {
      const testBytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const base64 = (adapter as any).arrayBufferToBase64(testBytes.buffer);

      expect(base64).toBe("SGVsbG8=");
    });
  });

  describe("WebSocket connection", () => {
    it("establishes WebSocket connection with correct URL", async () => {
      const connectPromise = (adapter as any).connectWebSocket();

      // Wait for connection
      await connectPromise;

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].url).toContain("wss://generativelanguage.googleapis.com/ws");
      expect(MockWebSocket.instances[0].url).toContain(mockApiKey);
    });

    it("sends setup message after connection", async () => {
      await (adapter as any).connectWebSocket();

      expect(MockWebSocket.instances[0].sentMessages).toHaveLength(1);

      const setupMessage = JSON.parse(MockWebSocket.instances[0].sentMessages[0]);
      expect(setupMessage.setup).toBeDefined();
      expect(setupMessage.setup.model).toBe(`models/${mockModel}`);
    });
  });

  describe("interim transcription", () => {
    it("interimInputTranscription is parsed", async () => {
      const onPartialMock = vi.fn();
      const signal = new AbortController().signal;

      // Create a mock blob with arrayBuffer method
      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      // Start transcription
      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate interim transcription
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          interimInputTranscription: {
            text: "Hello world"
          }
        }
      }));

      // Simulate another interim update
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          interimInputTranscription: {
            text: "Hello world this is a test"
          }
        }
      }));

      // Close connection to resolve transcription
      MockWebSocket.instances[0].close();

      await transcribePromise;

      expect(onPartialMock).toHaveBeenCalledWith("Hello world");
      expect(onPartialMock).toHaveBeenCalledWith("Hello world this is a test");
    });

    it("inputTranscription is parsed", async () => {
      const onPartialMock = vi.fn();
      const signal = new AbortController().signal;

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Finalized input sentence"
          }
        }
      }));

      MockWebSocket.instances[0].close();
      const result = await transcribePromise;

      expect(onPartialMock).toHaveBeenCalledWith("Finalized input sentence");
      expect(result.text).toBe("Finalized input sentence");
    });
  });

  describe("final transcription", () => {
    it("returns final transcription result", async () => {
      const signal = new AbortController().signal;

      // Create a mock blob with arrayBuffer method
      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate transcription
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Final transcript text"
          }
        }
      }));

      // Close connection to finalize
      MockWebSocket.instances[0].close();

      const result = await transcribePromise;

      expect(result.text).toBe("Final transcript text");
      expect(result.providerId).toBe("gemini-transcribe");
    });

    it("sends audio data as base64 encoded", async () => {
      const signal = new AbortController().signal;
      const testBlob = new Blob(["test audio data"], { type: "audio/webm" }) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      testBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: testBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      // Wait for connection and audio send
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second message should be audio data
      expect(MockWebSocket.instances[0].sentMessages.length).toBeGreaterThanOrEqual(2);
      const audioMessage = JSON.parse(MockWebSocket.instances[0].sentMessages[1]);

      expect(audioMessage.realtimeInput).toBeDefined();
      expect(audioMessage.realtimeInput.audio).toBeDefined();
      expect(audioMessage.realtimeInput.audio.mimeType).toBe("audio/pcm;rate=16000");
      expect(audioMessage.realtimeInput.audio.data).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

      // Clean up
      MockWebSocket.instances[0].close();
      await transcribePromise.catch(() => {});
    });
  });

  describe("cancel/close cleanup", () => {
    it("closes WebSocket on direct close call", async () => {
      const signal = new AbortController().signal;

      // Create a mock blob with arrayBuffer method
      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );
      const catchHandler = transcribePromise.catch((err) => err);

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(MockWebSocket.instances[0].readyState).toBe(1); // OPEN

      // Direct close call
      adapter.close();

      // WebSocket should be closed
      expect(MockWebSocket.instances[0].readyState).toBe(3); // CLOSED

      // Handle the expected rejection from close
      const err = await catchHandler;
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("No speech detected. Please try again.");
    });

    it("cleans up resources on close", () => {
      adapter.close();

      expect((adapter as any).websocket).toBeNull();
      expect((adapter as any).resolveConnection).toBeNull();
      expect((adapter as any).rejectConnection).toBeNull();
      expect((adapter as any).resolveTranscription).toBeNull();
      expect((adapter as any).rejectTranscription).toBeNull();
      expect((adapter as any).onPartialCallback).toBeNull();
    });

    it("handles WebSocket errors gracefully", async () => {
      const signal = new AbortController().signal;

      // Create a mock blob with arrayBuffer method
      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate WebSocket error
      MockWebSocket.instances[0].simulateError(new Event("error"));

      // Should reject with connection error
      await expect(transcribePromise).rejects.toThrow("WebSocket connection failed");

      // Clean up the adapter to prevent interference with other tests
      adapter.close();

      // Wait a bit to ensure the cleanup completes
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe("adapter interface", () => {
    it("implements SttAdapter interface correctly", () => {
      expect(adapter.kind).toBe("live-websocket");
      expect(adapter.providerId).toBe("gemini-transcribe");
    });

    it("has correct adapter kind", () => {
      expect(adapter.kind).toBe("live-websocket");
    });
  });

  describe("WebSocket message parsing", () => {
    it("handles string messages correctly", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      // Send string message (standard case)
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "String message test"
          }
        }
      }));

      MockWebSocket.instances[0].close();
      await transcribePromise;

      expect(onPartialMock).toHaveBeenCalledWith("String message test");
    });

    it("handles Blob messages correctly", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      // Send Blob message
      MockWebSocket.instances[0].simulateMessageBlob(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Blob message test"
          }
        }
      }));

      // Wait for async Blob.text() processing
      await new Promise(resolve => setTimeout(resolve, 10));

      MockWebSocket.instances[0].close();
      await transcribePromise;

      expect(onPartialMock).toHaveBeenCalledWith("Blob message test");
    });

    it("handles ArrayBuffer messages correctly", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      // Send ArrayBuffer message
      MockWebSocket.instances[0].simulateMessageArrayBuffer(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "ArrayBuffer message test"
          }
        }
      }));

      MockWebSocket.instances[0].close();
      await transcribePromise;

      expect(onPartialMock).toHaveBeenCalledWith("ArrayBuffer message test");
    });

    it("handles malformed JSON without breaking session", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      // Send malformed JSON (should be logged but not crash)
      MockWebSocket.instances[0].simulateMessage("not valid json");

      // Session should still be able to receive valid messages
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Valid message after error"
          }
        }
      }));

      MockWebSocket.instances[0].close();
      await transcribePromise;

      // Should have received the valid message
      expect(onPartialMock).toHaveBeenCalledWith("Valid message after error");
    });

    it("handles messages without transcription field gracefully", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      // Send message without input_transcription (e.g., setup confirmation)
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        setup_complete: true
      }));

      // Should not call onPartial
      expect(onPartialMock).not.toHaveBeenCalled();

      // Send actual transcription
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Actual transcript"
          }
        }
      }));

      MockWebSocket.instances[0].close();
      await transcribePromise;

      // Should have received only the actual transcript
      expect(onPartialMock).toHaveBeenCalledTimes(1);
      expect(onPartialMock).toHaveBeenCalledWith("Actual transcript");
    });

    it("updates currentTranscript for final result", async () => {
      const signal = new AbortController().signal;

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      // Send interim transcript
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          interimInputTranscription: {
            text: "Interim"
          }
        }
      }));

      // Send final transcript
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Final transcript"
          }
        }
      }));

      MockWebSocket.instances[0].close();
      const result = await transcribePromise;

      // Should return the final transcript
      expect(result.text).toBe("Final transcript");
    });
  });

  describe("live streaming", () => {
    it("skips empty PCM chunks", () => {
      const ws = new MockWebSocket("wss://test.com");
      MockWebSocket.instances = [ws];
      ws.readyState = WebSocket.OPEN;
      (adapter as any).websocket = ws;

      const sendSpy = vi.spyOn(ws, 'send');

      // Try to send empty chunk
      adapter.sendAudioChunk(new ArrayBuffer(0));

      // Should not send
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it("sends non-empty PCM chunks", () => {
      const ws = new MockWebSocket("wss://test.com");
      MockWebSocket.instances = [ws];
      ws.readyState = WebSocket.OPEN;
      (adapter as any).websocket = ws;

      const sendSpy = vi.spyOn(ws, 'send');

      // Send non-empty chunk
      const pcmData = new Int16Array([100, 200, 300]).buffer;
      adapter.sendAudioChunk(pcmData);

      // Should send
      expect(sendSpy).toHaveBeenCalledOnce();
      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0] as string);
      expect(sentMessage.realtimeInput.audio.mimeType).toBe("audio/pcm;rate=16000");
      expect(sentMessage.realtimeInput.audio.data).toBeDefined();
    });

    it("sends audio stream end signal using realtimeInput.audioStreamEnd", () => {
      const ws = new MockWebSocket("wss://test.com");
      MockWebSocket.instances = [ws];
      ws.readyState = WebSocket.OPEN;
      (adapter as any).websocket = ws;

      const sendSpy = vi.spyOn(ws, 'send');

      // Send end signal
      adapter.sendAudioStreamEnd();

      // Should send correct message
      expect(sendSpy).toHaveBeenCalledOnce();
      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0] as string);
      expect(sentMessage.realtimeInput.audioStreamEnd).toBe(true);
    });

    it("interim transcript does not resolve stop()", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      let isResolved = false;
      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      ).then((res) => {
        isResolved = true;
        return res;
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Stream end is sent
      adapter.sendAudioStreamEnd();

      // Send only an interim transcript
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          interimInputTranscription: {
            text: "Interim words only"
          }
        }
      }));

      // Wait a tick
      await new Promise(resolve => setTimeout(resolve, 10));

      // Partial callback called, but Promise must NOT resolve on interim
      expect(onPartialMock).toHaveBeenCalledWith("Interim words only");
      expect(isResolved).toBe(false);
      expect((adapter as any).resolveTranscription).not.toBeNull();

      // Clean up
      adapter.close();
      await transcribePromise.catch(() => {});
    });

    it("final transcript after audioStreamEnd resolves stop() immediately", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      adapter.sendAudioStreamEnd();

      // Final transcript arrives
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Final complete sentence"
          }
        }
      }));

      // Promise resolves immediately without needing manual socket close
      const result = await transcribePromise;
      expect(result.text).toBe("Final complete sentence");
      expect(result.providerId).toBe("gemini-transcribe");
    });

    it("resolve happens before WebSocket close", async () => {
      const signal = new AbortController().signal;

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      adapter.sendAudioStreamEnd();

      let resolveClearedAtClose: boolean | null = null;
      const ws = MockWebSocket.instances[0];
      const origClose = ws.close.bind(ws);
      ws.close = () => {
        // Verify that the transcription resolver was already invoked and cleared BEFORE close() is called
        resolveClearedAtClose = (adapter as any).resolveTranscription === null;
        origClose();
      };

      // Send final transcript
      ws.simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "Order test transcript"
          }
        }
      }));

      const result = await transcribePromise;
      expect(result.text).toBe("Order test transcript");
      expect(resolveClearedAtClose).toBe(true);
    });

    it("callbacks are cleared and cannot resolve twice", async () => {
      const signal = new AbortController().signal;

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      adapter.sendAudioStreamEnd();

      // Send final transcript
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          inputTranscription: {
            text: "First final transcript"
          }
        }
      }));

      await transcribePromise;

      // Callbacks must be null
      expect((adapter as any).resolveTranscription).toBeNull();
      expect((adapter as any).rejectTranscription).toBeNull();

      // Triggering close or another message should not throw or resolve again
      expect(() => {
        (adapter as any).handleWebSocketClose();
      }).not.toThrow();
    });

    // ── Ordering-case tests ────────────────────────────────────────────────
    describe("ordering: final transcript vs audioStreamEnd", () => {
      function makeBlob() {
        const b = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
        b.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));
        return b;
      }

      it("order B: final transcript BEFORE audioStreamEnd → resolves immediately on audioStreamEnd", async () => {
        const signal = new AbortController().signal;

        const transcribePromise = adapter.transcribe(
          { blob: makeBlob(), mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
          { signal }
        );

        await new Promise(resolve => setTimeout(resolve, 50));

        // Final transcript arrives BEFORE ✓ is clicked
        MockWebSocket.instances[0].simulateMessage(JSON.stringify({
          serverContent: {
            inputTranscription: { text: "What I'm saying" }
          }
        }));

        // Ensure Promise has NOT resolved yet (stream not ended)
        let settled = false;
        transcribePromise.then(() => { settled = true; }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(settled).toBe(false);
        expect((adapter as any).hasFinalTranscript).toBe(true);

        // ✓ clicked → audioStreamEnd sent → must resolve immediately
        adapter.sendAudioStreamEnd();

        const result = await transcribePromise;
        expect(result.text).toBe("What I'm saying");
        expect(result.providerId).toBe("gemini-transcribe");
      });

      it("order A: audioStreamEnd BEFORE final transcript → resolves when final arrives", async () => {
        const signal = new AbortController().signal;

        const transcribePromise = adapter.transcribe(
          { blob: makeBlob(), mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
          { signal }
        );

        await new Promise(resolve => setTimeout(resolve, 50));

        // ✓ clicked first
        adapter.sendAudioStreamEnd();

        // Final arrives after
        MockWebSocket.instances[0].simulateMessage(JSON.stringify({
          serverContent: {
            inputTranscription: { text: "Delayed final" }
          }
        }));

        const result = await transcribePromise;
        expect(result.text).toBe("Delayed final");
        expect(result.providerId).toBe("gemini-transcribe");
      });

      it("order B: interim transcript BEFORE audioStreamEnd does NOT resolve stop()", async () => {
        const signal = new AbortController().signal;
        const onPartialMock = vi.fn();

        const transcribePromise = adapter.transcribe(
          { blob: makeBlob(), mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
          { signal, onPartial: onPartialMock }
        );

        await new Promise(resolve => setTimeout(resolve, 50));

        // Interim arrives first
        MockWebSocket.instances[0].simulateMessage(JSON.stringify({
          serverContent: {
            interimInputTranscription: { text: "Interim only" }
          }
        }));

        await new Promise(resolve => setTimeout(resolve, 10));

        // hasFinalTranscript must remain false for interim messages
        expect((adapter as any).hasFinalTranscript).toBe(false);
        expect(onPartialMock).toHaveBeenCalledWith("Interim only");
        expect((adapter as any).resolveTranscription).not.toBeNull();

        // audioStreamEnd with no final transcript must NOT resolve
        adapter.sendAudioStreamEnd();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect((adapter as any).resolveTranscription).not.toBeNull();

        // clean up
        adapter.close();
        await transcribePromise.catch(() => {});
      });

      it("double final: second final transcript does not re-resolve after order-B path", async () => {
        const signal = new AbortController().signal;

        const transcribePromise = adapter.transcribe(
          { blob: makeBlob(), mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
          { signal }
        );

        await new Promise(resolve => setTimeout(resolve, 50));

        // First final arrives
        MockWebSocket.instances[0].simulateMessage(JSON.stringify({
          serverContent: { inputTranscription: { text: "First" } }
        }));
        // Stream end → resolves
        adapter.sendAudioStreamEnd();
        const result = await transcribePromise;
        expect(result.text).toBe("First");

        // Callbacks must be null
        expect((adapter as any).resolveTranscription).toBeNull();
        expect((adapter as any).rejectTranscription).toBeNull();

        // A second final message must not throw and must not re-resolve
        expect(() => {
          // adapter is already closed; simulate the socket delivering a stale message
          (adapter as any).handleWebSocketMessage(
            new MessageEvent("message", {
              data: JSON.stringify({ serverContent: { inputTranscription: { text: "Second" } } }),
            })
          );
        }).not.toThrow();
      });

      it("WebSocket is closed AFTER resolve, not before (order-B path)", async () => {
        const signal = new AbortController().signal;

        const transcribePromise = adapter.transcribe(
          { blob: makeBlob(), mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
          { signal }
        );

        await new Promise(resolve => setTimeout(resolve, 50));

        let resolveWasAlreadyClearedWhenCloseCalled: boolean | null = null;
        const ws = MockWebSocket.instances[0];
        const origClose = ws.close.bind(ws);
        ws.close = () => {
          resolveWasAlreadyClearedWhenCloseCalled = (adapter as any).resolveTranscription === null;
          origClose();
        };

        // Final arrives first (order B)
        ws.simulateMessage(JSON.stringify({
          serverContent: { inputTranscription: { text: "Close-order test" } }
        }));

        // audioStreamEnd triggers resolution + close
        adapter.sendAudioStreamEnd();

        const result = await transcribePromise;
        expect(result.text).toBe("Close-order test");
        expect(resolveWasAlreadyClearedWhenCloseCalled).toBe(true);
      });
    });
    // ── end ordering tests ────────────────────────────────────────────────

    it("socket-close fallback still returns the last transcript", async () => {
      const signal = new AbortController().signal;
      const onPartialMock = vi.fn();

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal, onPartial: onPartialMock }
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      // Receive partial transcript before unexpected close
      MockWebSocket.instances[0].simulateMessage(JSON.stringify({
        serverContent: {
          interimInputTranscription: {
            text: "Last received before disconnect"
          }
        }
      }));

      // Socket closes unexpectedly without final transcript
      MockWebSocket.instances[0].close();

      const result = await transcribePromise;
      expect(result.text).toBe("Last received before disconnect");
      expect(result.providerId).toBe("gemini-transcribe");
    });

    it("throws no_speech_detected error when no transcript is received", async () => {
      const signal = new AbortController().signal;

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      // Socket closes without any transcript (silent recording)
      MockWebSocket.instances[0].close();

      await expect(transcribePromise).rejects.toThrow("No speech detected. Please try again.");
    });

    it("cancel closes immediately without waiting", async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      const mockBlob = new Blob(["test audio"]) as Blob & { arrayBuffer: () => Promise<ArrayBuffer> };
      mockBlob.arrayBuffer = () => Promise.resolve(new ArrayBuffer(100));

      const transcribePromise = adapter.transcribe(
        { blob: mockBlob, mimeType: "audio/webm", durationMs: 1000, sizeBytes: 100, deviceId: null, chunkCount: 1 },
        { signal }
      );

      await new Promise(resolve => setTimeout(resolve, 20));

      // Abort (cancel)
      controller.abort();

      // Should close immediately
      await expect(transcribePromise).rejects.toThrow("Transcription cancelled");

      // WebSocket should be closed
      expect((adapter as any).websocket).toBeNull();
    });
  });
});
