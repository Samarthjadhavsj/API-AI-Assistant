/**
 * LivePcmStreamer bridges microphone audio to a live STT adapter.
 * Converts audio to 16-bit PCM at 16kHz using AudioWorklet and streams chunks.
 */

// Vite compiles the TypeScript worklet into its own JavaScript file (served as
// JS in dev, emitted as a .js asset in production). Importing the .ts file with
// `new URL(...)` instead ships it uncompiled, which addModule() rejects.
import pcmWorkletUrl from "./pcm-processor.worklet.ts?worker&url";

export const PCM_WORKLET_URL: string = pcmWorkletUrl;

export interface LivePcmStreamerOptions {
  stream: MediaStream;
  onChunk: (pcmData: ArrayBuffer) => void;
  onError: (error: Error) => void;
}

export interface ILivePcmStreamer {
  start(): Promise<void>;
  stop(): Promise<void>;
  cancel(): void;
  hasSpeechDetected(): boolean;
}

export class LivePcmStreamer implements ILivePcmStreamer {
  private readonly stream: MediaStream;
  private readonly onChunk: (pcmData: ArrayBuffer) => void;
  private readonly onError: (error: Error) => void;

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isActive = false;
  /** Set by stop()/cancel(); a start still loading the worklet then stands down. */
  private disposed = false;
  private speechDetected = false;

  // Threshold for speech detection (RMS amplitude for 16-bit PCM)
  // Values below this are considered background noise
  private readonly SPEECH_THRESHOLD = 500; // ~1.5% of max amplitude

  constructor({ stream, onChunk, onError }: LivePcmStreamerOptions) {
    this.stream = stream;
    this.onChunk = onChunk;
    this.onError = onError;
  }

  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error("LivePcmStreamer already started");
    }

    try {
      // Create AudioContext with 16kHz sample rate for efficiency
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Load the AudioWorklet processor
      await this.audioContext.audioWorklet.addModule(PCM_WORKLET_URL);

      // Stopped or cancelled while the worklet loaded: build nothing more.
      if (this.disposed) {
        this.cleanup();
        return;
      }

      // Create source from MediaStream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Create worklet processor node
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'pcm-processor-worklet',
        {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
        }
      );

      // Listen for PCM chunks from worklet
      this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (this.isActive) {
          const pcmData = event.data;
          this.detectSpeech(pcmData);
          this.onChunk(pcmData);
        }
      };

      // Connect the audio graph
      this.sourceNode.connect(this.workletNode);

      this.isActive = true;
      console.log("[LivePcmStreamer] Started streaming PCM audio");
    } catch (error) {
      this.cleanup();
      // A failure caused by stopping mid-start isn't an error to report.
      if (this.disposed) return;
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.disposed = true;
    if (!this.isActive) {
      // Still starting: release what exists so far.
      this.cleanup();
      return;
    }

    console.log("[LivePcmStreamer] Stopping PCM streaming");
    this.isActive = false;
    this.cleanup();
  }

  cancel(): void {
    console.log("[LivePcmStreamer] Canceling PCM streaming");
    this.disposed = true;
    this.isActive = false;
    this.cleanup();
  }

  hasSpeechDetected(): boolean {
    return this.speechDetected;
  }

  private detectSpeech(pcmData: ArrayBuffer): void {
    if (this.speechDetected) return; // Already detected speech

    // Calculate RMS amplitude for 16-bit PCM
    const samples = new Int16Array(pcmData);
    let sumSquares = 0;

    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }

    const rms = Math.sqrt(sumSquares / samples.length);

    if (rms > this.SPEECH_THRESHOLD) {
      this.speechDetected = true;
      console.log("[LivePcmStreamer] Speech detected, RMS:", rms);
    }
  }

  private cleanup(): void {
    try {
      // Disconnect audio nodes
      if (this.workletNode) {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
        this.workletNode = null;
      }

      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      // Close audio context
      if (this.audioContext) {
        if (this.audioContext.state !== 'closed') {
          void this.audioContext.close();
        }
        this.audioContext = null;
      }

      console.log("[LivePcmStreamer] Cleanup complete");
    } catch (error) {
      console.error("[LivePcmStreamer] Error during cleanup:", error);
    }
  }
}
