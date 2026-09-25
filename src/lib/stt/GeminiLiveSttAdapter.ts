import { AudioArtifact, SttAdapter, SttResult } from "@/lib/voice/types";
import { voiceError } from "@/lib/voice/errors";
import {
  geminiLiveProfileFor,
  type GeminiLiveVoiceProfile,
} from "@/config/gemini-models.constants";
import { formatGeminiLiveError } from "@/lib/functions/gemini-live-stt.function";

const GEMINI_LIVE_MODEL = "gemini-3.5-transcribe-live";
const WEBSOCKET_URL_TEMPLATE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}";

const SEGMENTS_PROFILE: GeminiLiveVoiceProfile = { responseModality: "TEXT", transcript: "segments" };
/** 100 ms of 16 kHz 16-bit mono silence. */
const SILENCE_CHUNK_MS = 100;
const SILENCE_CHUNK_BYTES = 3200;
const DEFAULT_SETTLE_MS = 800;
/** Upper bound on waiting for the transcript after speech ends. */
const MAX_WAIT_AFTER_END_MS = 12_000;

interface GeminiLiveSetupMessage {
  setup: {
    model: string;
    generationConfig: {
      responseModalities: string[];
      thinkingConfig?: { thinkingLevel: string };
    };
    inputAudioTranscription: Record<string, unknown>;
    realtimeInputConfig?: { automaticActivityDetection: { disabled: boolean } };
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
    text?: string;
  };
  interimInputTranscription?: {
    text: string;
  };
  turnComplete?: boolean;
}

interface GeminiLiveServerMessage {
  setupComplete?: unknown;
  serverContent?: GeminiLiveServerContent;
}

/**
 * Gemini Live API transcription adapter using WebSocket for real-time streaming.
 *
 * How a model is driven depends on its profile (see gemini-models.constants):
 * - "segments" (Transcribe Live): text responses, Gemini's own voice activity
 *   detection, interim + final transcript segments.
 * - "stream" (native-audio / conversational Live models): the response modality
 *   the model accepts, speech start/end marked explicitly (so Done ends the
 *   turn at once), transcript deltas appended as sent, and the result returned
 *   once no more transcript arrives. The model's spoken reply is ignored.
 */
export class GeminiLiveSttAdapter implements SttAdapter {
  readonly kind = "live-websocket" as const;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly profile: GeminiLiveVoiceProfile;
  private websocket: WebSocket | null = null;
  // "stream" profile state
  private setupComplete = false;
  private pendingChunks: ArrayBuffer[] = [];
  private endRequested = false;
  private activityEnded = false;
  private streamTranscript = "";
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by close(), so an in-flight trailing-silence loop stops. */
  private session = 0;
  private currentTranscript = "";
  /** Finalized segments accumulated for this session. */
  private committedTranscript = "";
  /** Current in-progress segment; replaced on each interim update. */
  private interimTranscript = "";
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
    variables: Record<string, string>,
    profile?: GeminiLiveVoiceProfile
  ) {
    this.apiKey = variables.api_key || "";
    this.model = variables.model?.trim() || GEMINI_LIVE_MODEL;
    this.profile = profile ?? geminiLiveProfileFor(this.model) ?? SEGMENTS_PROFILE;
  }

  private get isStream(): boolean {
    return this.profile.transcript === "stream";
  }

  private getWebSocketUrl(): string {
    return WEBSOCKET_URL_TEMPLATE.replace("{API_KEY}", this.apiKey);
  }

  private createSetupMessage(): GeminiLiveSetupMessage {
    const { responseModality, thinkingLevel } = this.profile;
    return {
      setup: {
        model: `models/${this.model}`,
        generationConfig: {
          responseModalities: [responseModality],
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        },
        inputAudioTranscription: {},
        // Speech start/end are sent explicitly for these models.
        ...(this.isStream
          ? { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } }
          : {}),
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

  private resetTranscripts(): void {
    this.currentTranscript = "";
    this.committedTranscript = "";
    this.interimTranscript = "";
  }

  private joinCommittedAndInterim(): string {
    if (!this.committedTranscript) return this.interimTranscript;
    if (!this.interimTranscript) return this.committedTranscript;
    return `${this.committedTranscript} ${this.interimTranscript}`;
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

      if (this.isStream) {
        this.handleStreamMessage(message);
        return;
      }

      const interimTranscription = message.serverContent?.interimInputTranscription;
      const finalTranscription = message.serverContent?.inputTranscription;

      if (interimTranscription?.text !== undefined) {
        const transcript = interimTranscription.text;
        console.log("[GeminiLiveSttAdapter] Received interim transcript:", transcript);
        this.interimTranscript = transcript;
        this.currentTranscript = this.joinCommittedAndInterim();
        this.onPartialCallback?.(this.currentTranscript);
        // Interim transcriptions never resolve stop().
      }

      if (finalTranscription?.text !== undefined) {
        const transcript = finalTranscription.text.trim();
        console.log("[GeminiLiveSttAdapter] Received final transcript:", transcript);
        if (transcript) {
          this.committedTranscript = this.committedTranscript
            ? `${this.committedTranscript} ${transcript}`
            : transcript;
          this.interimTranscript = "";
          this.currentTranscript = this.committedTranscript;
          this.hasFinalTranscript = true;
          this.onPartialCallback?.(this.currentTranscript);

          // Order A: audioStreamEnd already sent → resolve immediately.
          // Order B: audioStreamEnd not yet sent → sendAudioStreamEnd() will resolve.
          if (this.isStreamEnded && this.resolveTranscription) {
            const resolve = this.resolveTranscription;
            this.resolveTranscription = null;
            this.rejectTranscription = null;

            resolve({
              text: this.currentTranscript,
              providerId: this.providerId,
            });

            // Close WebSocket after resolving (not before).
            this.close();
          }
        }
      }
    } catch (error) {
      console.error("[GeminiLiveSttAdapter] Error parsing WebSocket message:", error);
      // Don't fail the entire session on a single bad message
      // The session can continue to receive other messages
    }
  };

  // --- "stream" profile ------------------------------------------------------

  private handleStreamMessage(message: GeminiLiveServerMessage): void {
    if (message.setupComplete !== undefined && !this.setupComplete) {
      this.setupComplete = true;
      this.sendJson({ realtimeInput: { activityStart: {} } });
      const pending = this.pendingChunks;
      this.pendingChunks = [];
      pending.forEach((chunk) => this.sendJson(this.createAudioMessage(chunk)));
      if (this.endRequested) void this.finishStream();
      return;
    }

    const serverContent = message.serverContent;
    const delta = serverContent?.inputTranscription?.text;
    if (typeof delta === "string" && delta) {
      // Deltas carry their own spacing (" What", " co", "lor").
      this.streamTranscript += delta;
      this.currentTranscript = this.streamTranscript.replace(/\s+/g, " ").trim();
      this.onPartialCallback?.(this.currentTranscript);
      if (this.activityEnded) this.scheduleSettle();
    }

    if (serverContent?.turnComplete && this.activityEnded && this.currentTranscript) {
      this.resolveStream();
    }
  }

  private sendJson(message: unknown): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /** Ends the speech turn: optional real-time trailing silence, then activityEnd. */
  private async finishStream(): Promise<void> {
    const session = this.session;
    const silenceMs = this.profile.trailingSilenceMs ?? 0;
    const silence = new ArrayBuffer(SILENCE_CHUNK_BYTES);
    for (let sent = 0; sent < silenceMs; sent += SILENCE_CHUNK_MS) {
      if (session !== this.session) return;
      this.sendJson(this.createAudioMessage(silence));
      await new Promise((resolve) => setTimeout(resolve, SILENCE_CHUNK_MS));
    }
    if (session !== this.session) return;

    this.sendJson({ realtimeInput: { activityEnd: {} } });
    this.activityEnded = true;
    if (this.currentTranscript) this.scheduleSettle();
    this.maxWaitTimer = setTimeout(() => {
      if (this.currentTranscript) {
        this.resolveStream();
      } else {
        const reject = this.rejectTranscription;
        this.resolveTranscription = null;
        this.rejectTranscription = null;
        this.close();
        reject?.(new Error(voiceError("no_speech_detected").message));
      }
    }, MAX_WAIT_AFTER_END_MS);
  }

  /** The transcript is complete once no more of it arrives for a moment. */
  private scheduleSettle(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(
      () => this.resolveStream(),
      this.profile.settleMs ?? DEFAULT_SETTLE_MS
    );
  }

  private resolveStream(): void {
    const resolve = this.resolveTranscription;
    if (!resolve) return;
    const text = this.currentTranscript;
    this.resolveTranscription = null;
    this.rejectTranscription = null;
    resolve({ text, providerId: this.providerId });
    // Close after resolving (not before).
    this.close();
  }

  /** A setup rejection (unknown model, wrong modality) explained, not "no speech". */
  private closeError(event: Event): Error | null {
    const { code, reason } = event as CloseEvent;
    if (typeof code !== "number" || code === 1000 || code === 1005 || !reason) return null;
    if (/not found|not supported for bidiGenerateContent/i.test(reason)) {
      return new Error(
        `The voice model "${this.model}" isn't available for this API key. Choose another model in Settings.`
      );
    }
    return formatGeminiLiveError(reason);
  }

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

  private handleWebSocketClose = (event: Event) => {
    this.websocket = null;
    this.clearStreamTimers();

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
        reject(this.closeError(event) ?? new Error(error.message));
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
    this.resetTranscripts();
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
      if (this.isStream) {
        this.sendAudioChunk(arrayBuffer);
      } else {
        const audioMessage = this.createAudioMessage(arrayBuffer);
        this.websocket?.send(JSON.stringify(audioMessage));
      }

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
    // Stream models: hold audio until setup completes and speech has been
    // marked as started, so the first words aren't lost.
    if (this.isStream) {
      if (pcmData.byteLength === 0) return;
      if (!this.setupComplete) {
        this.pendingChunks.push(pcmData);
        return;
      }
      this.sendJson(this.createAudioMessage(pcmData));
      return;
    }

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
    if (this.isStream) {
      if (this.endRequested || this.activityEnded) return;
      this.isStreamEnded = true;
      this.endRequested = true;
      // Before setup completes, the end is sent once buffered audio is flushed.
      if (this.setupComplete) void this.finishStream();
      return;
    }

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

  private clearStreamTimers(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    if (this.maxWaitTimer) clearTimeout(this.maxWaitTimer);
    this.settleTimer = null;
    this.maxWaitTimer = null;
  }

  close(): void {
    this.session += 1;
    this.clearStreamTimers();
    this.setupComplete = false;
    this.pendingChunks = [];
    this.endRequested = false;
    this.activityEnded = false;
    this.streamTranscript = "";
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
    this.resetTranscripts();
  }
}
