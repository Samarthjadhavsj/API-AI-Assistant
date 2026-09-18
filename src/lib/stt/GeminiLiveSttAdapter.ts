import { AudioArtifact, SttAdapter, SttResult } from "@/lib/voice/types";
import { voiceError } from "@/lib/voice/errors";

const GEMINI_LIVE_MODEL = "gemini-3.5-transcribe-live";
const WEBSOCKET_URL_TEMPLATE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}";

interface GeminiLiveSetupMessage {
  setup: {
    model: string;
    generationConfig: {
      responseModalities: string[];
    };
    inputAudioTranscription: Record<string, unknown>;
  };
}

interface GeminiLiveAudioMessage {
  realtimeInput: {
    audio: {
      data: string;
      mimeType: string;
    };
  };
}

interface GeminiLiveStreamEndMessage {
  realtimeInput: {
    audioStreamEnd: true;
  };
}

interface GeminiLiveServerContent {
  inputTranscription?: {
    text: string;
  };
  interimInputTranscription?: {
    text: string;
  };
}

interface GeminiLiveServerMessage {
  serverContent?: GeminiLiveServerContent;
}

/**
 * Gemini Live API transcription adapter using WebSocket for real-time streaming.
 * Connects to gemini-3.5-transcribe-live model for low-latency speech-to-text.
 */
export class GeminiLiveSttAdapter implements SttAdapter {
  readonly kind = "live-websocket" as const;
  private readonly apiKey: string;
  private readonly model: string;
  private websocket: WebSocket | null = null;
  private currentTranscript = "";
  private resolveConnection: ((value: void) => void) | null = null;
  private rejectConnection: ((error: Error) => void) | null = null;
  private resolveTranscription: ((result: SttResult) => void) | null = null;
  private rejectTranscription: ((error: Error) => void) | null = null;
  private onPartialCallback: ((text: string) => void) | null = null;
  private abortHandler: (() => void) | null = null;
  private isStreamEnded = false;
  /** True once a FINAL inputTranscription has been received (never set by interim). */
  private hasFinalTranscript = false;

  constructor(
    readonly providerId: string,
    variables: Record<string, string>
  ) {
    this.apiKey = variables.api_key || "";
    this.model = variables.model || GEMINI_LIVE_MODEL;
  }

  private getWebSocketUrl(): string {
    return WEBSOCKET_URL_TEMPLATE.replace("{API_KEY}", this.apiKey);
  }

  private createSetupMessage(): GeminiLiveSetupMessage {
    return {
      setup: {
        model: `models/${this.model}`,
        generationConfig: {
          responseModalities: ["TEXT"],
        },
        inputAudioTranscription: {},
      },
    };
  }

  private createAudioMessage(audioData: ArrayBuffer): GeminiLiveAudioMessage {
    // Convert ArrayBuffer to base64
    const base64Data = this.arrayBufferToBase64(audioData);
    return {
      realtimeInput: {
        audio: {
          data: base64Data,
          mimeType: "audio/pcm;rate=16000",
        },
      },
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private handleWebSocketOpen = () => {
    console.log("[GeminiLiveSttAdapter] WebSocket connected");

    // Send setup message
    const setupMessage = this.createSetupMessage();
    this.websocket?.send(JSON.stringify(setupMessage));
    console.log("[GeminiLiveSttAdapter] Setup message sent");

    this.resolveConnection?.();
  };

  private handleWebSocketMessage = async (event: MessageEvent) => {
    try {
      // Handle different WebSocket message data types
      let textData: string;

      if (typeof event.data === 'string') {
        // String: use directly
        textData = event.data;
      } else if (event.data instanceof Blob) {
        // Blob: convert to text
        textData = await event.data.text();
      } else if (
        event.data instanceof ArrayBuffer ||
        (event.data && typeof event.data === 'object' && 'byteLength' in event.data && 'slice' in event.data)
      ) {
        // ArrayBuffer or ArrayBuffer-like: decode with TextDecoder
        const decoder = new TextDecoder('utf-8');
        textData = decoder.decode(event.data);
      } else {
        console.warn("[GeminiLiveSttAdapter] Unexpected WebSocket data type:", typeof event.data, event.data);
        return;
      }

      const rawObj: Record<string, any> = JSON.parse(textData);

      const message: GeminiLiveServerMessage = rawObj as GeminiLiveServerMessage;

      const interimTranscription = message.serverContent?.interimInputTranscription;
      const finalTranscription = message.serverContent?.inputTranscription;

      if (interimTranscription?.text !== undefined) {
        const transcript = interimTranscription.text;
        console.log("[GeminiLiveSttAdapter] Received interim transcript:", transcript);
        this.currentTranscript = transcript;
        this.onPartialCallback?.(transcript);
        // Interim transcriptions never resolve stop().
      }

      if (finalTranscription?.text !== undefined) {
        const transcript = finalTranscription.text;
        console.log("[GeminiLiveSttAdapter] Received final transcript:", transcript);
        this.currentTranscript = transcript;
        this.hasFinalTranscript = true;
        this.onPartialCallback?.(transcript);

        // Order A: audioStreamEnd already sent → resolve immediately.
        // Order B: audioStreamEnd not yet sent → sendAudioStreamEnd() will resolve.
        if (this.isStreamEnded && this.resolveTranscription) {
          const resolve = this.resolveTranscription;
          this.resolveTranscription = null;
          this.rejectTranscription = null;

          resolve({
            text: transcript,
            providerId: this.providerId,
          });

          // Close WebSocket after resolving (not before).
          this.close();
        }
      }
    } catch (error) {
      console.error("[GeminiLiveSttAdapter] Error parsing WebSocket message:", error);
      // Don't fail the entire session on a single bad message
      // The session can continue to receive other messages
    }
  };

  private handleWebSocketError = (error: Event) => {
    console.error("[GeminiLiveSttAdapter] WebSocket error:", error);
    // Clear handlers to prevent onclose from overriding the error
    const reject = this.rejectConnection;
    const transcribeReject = this.rejectTranscription;
    this.resolveConnection = null;
    this.rejectConnection = null;
    this.resolveTranscription = null;
    this.rejectTranscription = null;

    reject?.(new Error("WebSocket connection failed"));
    transcribeReject?.(new Error("WebSocket connection failed"));
  };

  private handleWebSocketClose = () => {
    this.websocket = null;

    // Only resolve/reject if not already handled by abort or final transcript
    if (this.resolveTranscription && this.rejectTranscription) {
      const resolve = this.resolveTranscription;
      const reject = this.rejectTranscription;
      this.resolveTranscription = null;
      this.rejectTranscription = null;

      // Resolve transcription with final result when connection closes
      if (this.currentTranscript) {
        resolve({
          text: this.currentTranscript,
          providerId: this.providerId,
        });
      } else {
        const error = voiceError("no_speech_detected");
        reject(new Error(error.message));
      }
    }
  };

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.resolveConnection = resolve;
      this.rejectConnection = reject;

      try {
        const url = this.getWebSocketUrl();
        console.log("[GeminiLiveSttAdapter] Connecting to WebSocket:", url.replace(this.apiKey, "***"));

        this.websocket = new WebSocket(url);

        this.websocket.onopen = this.handleWebSocketOpen;
        this.websocket.onmessage = this.handleWebSocketMessage;
        this.websocket.onerror = this.handleWebSocketError;
        this.websocket.onclose = this.handleWebSocketClose;
      } catch (error) {
        reject(error);
      }
    });
  }

  async transcribe(
    artifact: AudioArtifact,
    { signal, onPartial }: { signal: AbortSignal; onPartial?: (text: string) => void }
  ): Promise<SttResult> {
    if (signal.aborted) {
      throw new DOMException("Transcription cancelled.", "AbortError");
    }

    // Check if this is a result artifact from LiveRecorderEngine
    if (artifact.mimeType === "text/plain" && artifact.blob.size > 0) {
      // Live path: extract the pre-transcribed text
      const text = await artifact.blob.text();
      return {
        text,
        providerId: this.providerId,
      };
    }

    // Batch path: process audio normally
    this.onPartialCallback = onPartial || null;
    this.currentTranscript = "";
    this.isStreamEnded = false;

    // Create transcription promise
    const transcriptionPromise = new Promise<SttResult>((resolve, reject) => {
      this.resolveTranscription = resolve;
      this.rejectTranscription = reject;
    });

    // Handle abort signal
    this.abortHandler = () => {
      // Clear the handlers to prevent onclose from overriding the abort error
      const reject = this.rejectTranscription;
      this.resolveTranscription = null;
      this.rejectTranscription = null;

      this.close();
      reject?.(new DOMException("Transcription cancelled.", "AbortError"));
    };

    signal.addEventListener("abort", this.abortHandler);

    try {
      // Connect to WebSocket
      await this.connectWebSocket();

      // Convert audio blob to ArrayBuffer and send as chunks
      const arrayBuffer = await artifact.blob.arrayBuffer();
      console.log("[GeminiLiveSttAdapter] Sending audio data, size:", arrayBuffer.byteLength);

      // Send audio as single chunk (could be chunked further for optimization)
      const audioMessage = this.createAudioMessage(arrayBuffer);
      this.websocket?.send(JSON.stringify(audioMessage));

      // Wait for transcription to complete
      const result = await transcriptionPromise;

      // Close connection after receiving result
      this.close();

      return result;
    } catch (error) {
      this.close();
      throw error;
    }
  }

  /**
   * Send an audio chunk for live streaming mode.
   * Must be called after transcribe() has initiated the WebSocket connection.
   */
  sendAudioChunk(pcmData: ArrayBuffer): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn("[GeminiLiveSttAdapter] Cannot send chunk: WebSocket not open");
      return;
    }

    // Skip empty chunks
    if (pcmData.byteLength === 0) {
      console.log("[GeminiLiveSttAdapter] Skipping empty audio chunk");
      return;
    }

    console.log("[GeminiLiveSttAdapter] Sending audio data, size:", pcmData.byteLength);
    const audioMessage = this.createAudioMessage(pcmData);
    this.websocket.send(JSON.stringify(audioMessage));
  }

  /**
   * Send end-of-stream signal to indicate no more audio will be sent.
   * This allows Gemini to finalize the transcription immediately.
   */
  sendAudioStreamEnd(): void {
    const isOpen = !!this.websocket && this.websocket.readyState === WebSocket.OPEN;

    if (!this.websocket || !isOpen) {
      console.warn("[GeminiLiveSttAdapter] Cannot send stream end: WebSocket not open");
      return;
    }

    this.isStreamEnded = true;

    console.log("[GeminiLiveSttAdapter] Sending audio stream end signal");
    const endMessage: GeminiLiveStreamEndMessage = {
      realtimeInput: {
        audioStreamEnd: true,
      },
    };
    this.websocket.send(JSON.stringify(endMessage));

    // Order B: final transcript already arrived before audioStreamEnd.
    // Resolve immediately with the cached final transcript.
    if (this.hasFinalTranscript && this.resolveTranscription) {
      const resolve = this.resolveTranscription;
      const transcript = this.currentTranscript;
      this.resolveTranscription = null;
      this.rejectTranscription = null;

      console.log("[GeminiLiveSttAdapter] Resolving with cached final transcript:", transcript);
      resolve({
        text: transcript,
        providerId: this.providerId,
      });

      // Close WebSocket after resolving (not before).
      this.close();
    }
  }

  close(): void {
    if (this.websocket) {
      console.log("[GeminiLiveSttAdapter] Closing WebSocket connection");
      this.websocket.close();
      this.websocket = null;
    }
    // Clear handlers to prevent onclose from overriding
    this.resolveConnection = null;
    this.rejectConnection = null;
    this.resolveTranscription = null;
    this.rejectTranscription = null;
    this.onPartialCallback = null;
    this.abortHandler = null;
    this.isStreamEnded = false;
    this.hasFinalTranscript = false;
  }
}
