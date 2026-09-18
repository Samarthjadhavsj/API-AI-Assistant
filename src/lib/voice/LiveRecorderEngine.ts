/**
 * LiveRecorderEngine streams microphone audio as PCM to a live STT adapter.
 * Unlike RecorderEngine (batch), this streams continuously without MediaRecorder.
 */

import { IRecorderEngine, RecorderEngineOptions } from "./RecorderEngine";
import { LivePcmStreamer, ILivePcmStreamer } from "./LivePcmStreamer";
import { AudioArtifact, SttAdapter, SttResult } from "./types";
import { voiceError } from "./errors";

export interface LiveRecorderEngineOptions extends RecorderEngineOptions {
  adapter: SttAdapter & { kind: "live-websocket" };
}

export class LiveRecorderEngine implements IRecorderEngine {
  readonly stream: MediaStream;
  private readonly adapter: SttAdapter & { kind: "live-websocket" };
  private readonly deviceId: string | null;
  private readonly onFailure: (error: unknown) => void;
  private readonly startedAt = Date.now();

  private streamer: ILivePcmStreamer | null = null;
  private transcriptionPromise: Promise<SttResult> | null = null;
  private transcriptionAbort: AbortController | null = null;
  private stopped = false;
  private cancelled = false;

  constructor({ stream, deviceId, onFailure, adapter }: LiveRecorderEngineOptions) {
    this.stream = stream;
    this.deviceId = deviceId;
    this.onFailure = onFailure;
    this.adapter = adapter;
  }

  start(): void {
    if (this.stopped || this.cancelled) {
      throw new Error("Cannot restart a stopped/cancelled LiveRecorderEngine");
    }

    console.log("[LiveRecorderEngine] Starting live streaming");

    // Create abort controller for transcription
    this.transcriptionAbort = new AbortController();

    // Create a minimal AudioArtifact to initiate the WebSocket connection
    // The actual audio will be streamed via sendAudioChunk
    const artifact: AudioArtifact = {
      blob: new Blob([], { type: "audio/pcm" }),
      mimeType: "audio/pcm;rate=16000",
      durationMs: 0,
      sizeBytes: 0,
      deviceId: this.deviceId,
      sampleRate: 16000,
      chunkCount: 0,
    };

    // Start transcription (this initiates WebSocket connection)
    this.transcriptionPromise = this.adapter.transcribe(artifact, {
      signal: this.transcriptionAbort.signal,
      onPartial: (text) => {
        console.log("[LiveRecorderEngine] Partial transcript:", text);
        // Partial transcripts can be handled by the controller in the future
      },
    });

    // Create streamer with chunk callback
    this.streamer = new LivePcmStreamer({
      stream: this.stream,
      onChunk: (pcmData: ArrayBuffer) => {
        // Send PCM chunk to the live adapter
        if (this.adapter && 'sendAudioChunk' in this.adapter) {
          (this.adapter as any).sendAudioChunk(pcmData);
        }
      },
      onError: (error: Error) => {
        console.error("[LiveRecorderEngine] Streamer error:", error);
        this.onFailure(error);
      },
    });

    // Start streaming PCM
    void this.streamer.start().catch((error) => {
      console.error("[LiveRecorderEngine] Failed to start streamer:", error);
      this.onFailure(error);
    });
  }

  async stop(): Promise<AudioArtifact | null> {
    if (this.stopped || this.cancelled) {
      return null;
    }

    console.log("[LiveRecorderEngine] Stopping live streaming");
    this.stopped = true;

    // Check if speech was detected before waiting for Gemini
    const hasSpeech = this.streamer?.hasSpeechDetected() ?? false;
    console.log("[LiveRecorderEngine] Speech detected:", hasSpeech);

    // Stop the PCM streamer first (stop producing new audio)
    if (this.streamer) {
      await this.streamer.stop();
      this.streamer = null;
    }

    // If no speech was detected, short-circuit and return no_speech_detected error immediately
    if (!hasSpeech) {
      console.log("[LiveRecorderEngine] No speech detected, canceling transcription");
      if (this.transcriptionAbort) {
        this.transcriptionAbort.abort();
      }
      throw voiceError("no_speech_detected");
    }

    // Send end-of-stream signal to Gemini
    if (this.adapter && 'sendAudioStreamEnd' in this.adapter) {
      (this.adapter as any).sendAudioStreamEnd();
    }

    // Wait for transcription to complete (WebSocket stays open until final transcript)
    if (this.transcriptionPromise) {
      try {
        const result = await this.transcriptionPromise;

        // Return an artifact containing the transcript
        // The controller will call transcribe() again, but we'll make it a no-op
        const artifact: AudioArtifact = {
          blob: new Blob([result.text], { type: "text/plain" }),
          mimeType: "text/plain",
          durationMs: Date.now() - this.startedAt,
          sizeBytes: result.text.length,
          deviceId: this.deviceId,
          sampleRate: 16000,
          chunkCount: 1,
        };

        return artifact;
      } catch (error) {
        // If transcription failed or was aborted, throw the error
        console.error("[LiveRecorderEngine] Transcription error during stop:", error);
        throw error;
      }
    }

    return null;
  }

  async cancel(): Promise<void> {
    if (this.cancelled) return;

    console.log("[LiveRecorderEngine] Cancelling live streaming");
    this.cancelled = true;

    // Cancel the PCM streamer
    if (this.streamer) {
      this.streamer.cancel();
      this.streamer = null;
    }

    // Abort transcription
    if (this.transcriptionAbort) {
      this.transcriptionAbort.abort();
      this.transcriptionAbort = null;
    }

    // Discard transcription promise
    this.transcriptionPromise = null;
  }

  releaseTracks(): void {
    const tracks = this.stream.getTracks();
    console.log("[LiveRecorderEngine] Releasing media stream tracks", {
      trackCount: tracks.length,
      tracks: tracks.map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState }))
    });

    tracks.forEach((track) => {
      try {
        if (track.readyState !== 'ended') {
          console.log("[LiveRecorderEngine] Stopping track", { id: track.id, kind: track.kind });
          track.stop();
          console.log("[LiveRecorderEngine] Track stopped successfully", { id: track.id });
        }
      } catch (error) {
        console.error("[LiveRecorderEngine] Error stopping track", { id: track.id, error });
      }
    });

    console.log("[LiveRecorderEngine] All tracks released");
  }
}
