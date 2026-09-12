import { chooseRecordingMimeType } from "@/lib/voice-recorder.utils";
import { buildAudioArtifact } from "./AudioArtifactBuilder";
import { AudioArtifact } from "./types";

export interface RecorderEngineOptions {
  stream: MediaStream;
  deviceId: string | null;
  onFailure: (error: unknown) => void;
}

export interface IRecorderEngine {
  readonly stream: MediaStream;
  start(): void;
  stop(): Promise<AudioArtifact | null>;
  cancel(): Promise<void>;
  releaseTracks(): void;
}

/** A MediaRecorder wrapper whose stop promise waits for its final data event. */
export class RecorderEngine implements IRecorderEngine {
  private static readonly STOP_TIMEOUT_MS = 10_000;
  readonly stream: MediaStream;
  private readonly recorder: MediaRecorder;
  private readonly deviceId: string | null;
  private readonly chunks: Blob[] = [];
  private readonly startedAt = Date.now();
  private readonly mimeType: string | undefined;
  private stopped: Promise<AudioArtifact | null> | null = null;
  private resolveStop: ((artifact: AudioArtifact | null) => void) | null = null;
  private rejectStop: ((error: unknown) => void) | null = null;
  private discard = false;
  private failed = false;

  constructor({ stream, deviceId, onFailure }: RecorderEngineOptions) {
    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder is not supported.");
    }

    this.stream = stream;
    this.deviceId = deviceId;
    this.mimeType = chooseRecordingMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
    this.recorder = this.mimeType
      ? new MediaRecorder(stream, { mimeType: this.mimeType })
      : new MediaRecorder(stream);
    this.recorder.ondataavailable = ({ data }) => {
      if (!this.discard && data.size > 0) this.chunks.push(data);
    };
    this.recorder.onerror = (event) => {
      if (this.failed) return;
      this.failed = true;
      const error = (event as Event & { error?: unknown }).error || new Error("MediaRecorder failed.");
      this.rejectStop?.(error);
      onFailure(error);
    };
    this.recorder.onstop = () => {
      this.resolveStop?.(this.buildArtifact());
      this.resolveStop = null;
      this.rejectStop = null;
    };
  }

  private buildArtifact(): AudioArtifact | null {
    if (this.discard) return null;
    return buildAudioArtifact({
      chunks: this.chunks,
      mimeType: this.recorder.mimeType || this.mimeType || "audio/webm",
      startedAt: this.startedAt,
      deviceId: this.deviceId,
    });
  }

  start() {
    this.recorder.start(250);
  }

  stop(): Promise<AudioArtifact | null> {
    if (this.stopped) return this.stopped;

    let settled = false;
    let hangSafety: ReturnType<typeof setTimeout> | undefined;
    this.stopped = new Promise<AudioArtifact | null>((resolve, reject) => {
      const finish = (artifact: AudioArtifact | null) => {
        if (settled) return;
        settled = true;
        if (hangSafety) clearTimeout(hangSafety);
        this.resolveStop = null;
        this.rejectStop = null;
        resolve(artifact);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        if (hangSafety) clearTimeout(hangSafety);
        this.resolveStop = null;
        this.rejectStop = null;
        reject(error);
      };

      this.resolveStop = finish;
      this.rejectStop = fail;
      hangSafety = setTimeout(
        () => fail(new Error("Timed out waiting for the microphone recording to finish.")),
        RecorderEngine.STOP_TIMEOUT_MS
      );
    });

    try {
      if (this.recorder.state !== "inactive") {
        try {
          this.recorder.requestData();
        } catch {
          // Some WebView builds throw if a timeslice is already in flight.
        }
        this.recorder.stop();
      } else {
        this.resolveStop?.(this.buildArtifact());
      }
    } catch (error) {
      this.rejectStop?.(error);
    }
    return this.stopped;
  }

  async cancel(): Promise<void> {
    this.discard = true;
    try {
      await this.stop();
    } catch {
      // The controller owns the terminal state and track cleanup.
    }
  }

  releaseTracks() {
    const tracks = this.stream.getTracks();
    console.log("[RecorderEngine] Releasing media stream tracks", {
      trackCount: tracks.length,
      tracks: tracks.map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState }))
    });
    
    tracks.forEach((track) => {
      try {
        if (track.readyState !== 'ended') {
          console.log("[RecorderEngine] Stopping track", { id: track.id, kind: track.kind, readyState: track.readyState });
          track.stop();
          console.log("[RecorderEngine] Track stopped successfully", { id: track.id, newState: track.readyState });
        } else {
          console.log("[RecorderEngine] Track already ended", { id: track.id });
        }
      } catch (error) {
        console.error("[RecorderEngine] Error stopping track", { id: track.id, error });
      }
    });
    
    // Verify all tracks are stopped
    const remainingActive = tracks.filter(t => t.readyState !== 'ended');
    if (remainingActive.length > 0) {
      console.warn("[RecorderEngine] Some tracks still active after cleanup", {
        active: remainingActive.map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState }))
      });
    } else {
      console.log("[RecorderEngine] All tracks successfully released");
    }
  }
}
