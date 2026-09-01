import { MicPermissionGateway, MicPermissionTimeoutError } from "./MicPermissionGateway";
import { IRecorderEngine, RecorderEngine, RecorderEngineOptions } from "./RecorderEngine";
import { microphoneVoiceError, voiceError } from "./errors";
import { SttResult, VoiceError, VoiceStartOptions, VoiceStateSnapshot } from "./types";

const IDLE_SNAPSHOT: VoiceStateSnapshot = {
  state: "idle",
  error: null,
  deviceId: null,
  startedAt: null,
  durationMs: 0,
  level: 0,
  stream: null,
  activeOwnerId: null,
};

type PermissionGateway = {
  request: MicPermissionGateway["request"];
};

type EngineFactory = (options: RecorderEngineOptions) => IRecorderEngine;

const BUSY_STATES = new Set(["requestingPermission", "recording", "finalizing", "transcribing"]);

/** Framework-agnostic owner of the single active microphone/STT session. */
export class VoiceRecorderController {
  private snapshot = IDLE_SNAPSHOT;
  private readonly listeners = new Set<(snapshot: VoiceStateSnapshot) => void>();
  private readonly permissionGateway: PermissionGateway;
  private readonly createEngine: EngineFactory;
  private engine: IRecorderEngine | null = null;
  private abortController: AbortController | null = null;
  private activeAdapter: VoiceStartOptions["adapter"] = null;
  private activeOnResult: VoiceStartOptions["onResult"];
  private sessionId = 0;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    permissionGateway: PermissionGateway = new MicPermissionGateway(),
    createEngine: EngineFactory = (options) => new RecorderEngine(options)
  ) {
    this.permissionGateway = permissionGateway;
    this.createEngine = createEngine;
  }

  getSnapshot = (): VoiceStateSnapshot => this.snapshot;

  subscribe = (listener: (snapshot: VoiceStateSnapshot) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(next: VoiceStateSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private transition(patch: Partial<VoiceStateSnapshot>) {
    this.publish({ ...this.snapshot, ...patch });
  }

  private clearTimers() {
    if (this.durationTimer) clearInterval(this.durationTimer);
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    this.durationTimer = null;
    this.maxDurationTimer = null;
  }

  private releaseEngine() {
    this.engine?.releaseTracks();
    this.engine = null;
  }

  private reset() {
    this.clearTimers();
    this.abortController = null;
    this.activeAdapter = null;
    this.activeOnResult = undefined;
    this.releaseEngine();
    this.publish(IDLE_SNAPSHOT);
  }

  private isOwnedBy(ownerId?: string) {
    if (!ownerId) return true;
    return this.snapshot.activeOwnerId === ownerId;
  }

  private asVoiceError(error: unknown): VoiceError {
    if (error && typeof error === "object" && "code" in error) {
      const candidate = error as Partial<VoiceError>;
      if (typeof candidate.code === "string" && candidate.code in {
        upload_failed: true,
        polling_timeout: true,
        provider_returned_no_text: true,
      }) {
        return voiceError(candidate.code as VoiceError["code"], error, candidate.message);
      }
    }
    return voiceError(
      "stt_request_failed",
      error,
      error instanceof Error ? error.message : undefined
    );
  }

  private fail(error: VoiceError, sessionId: number) {
    if (sessionId !== this.sessionId) return;
    const activeOwnerId = this.snapshot.activeOwnerId;
    this.sessionId += 1;
    this.clearTimers();
    this.abortController?.abort();
    this.abortController = null;
    this.activeAdapter = null;
    this.activeOnResult = undefined;
    this.releaseEngine();
    this.publish({ ...IDLE_SNAPSHOT, state: "error", error, activeOwnerId });
  }

  async start(options: VoiceStartOptions): Promise<boolean> {
    if (BUSY_STATES.has(this.snapshot.state)) {
      throw voiceError("recording_already_active");
    }
    if (!options.adapter) {
      const error = voiceError("provider_not_configured");
      this.publish({
        ...IDLE_SNAPSHOT,
        state: "error",
        error,
        activeOwnerId: options.ownerId,
      });
      return false;
    }

    const sessionId = ++this.sessionId;
    this.activeAdapter = options.adapter;
    this.activeOnResult = options.onResult;
    const deviceId = options.deviceId || null;
    this.publish({
      ...IDLE_SNAPSHOT,
      state: "requestingPermission",
      deviceId,
      activeOwnerId: options.ownerId,
    });

    let stream: MediaStream;
    try {
      stream = await this.permissionGateway.request(deviceId || undefined);
    } catch (error) {
      this.fail(
        error instanceof MicPermissionTimeoutError
          ? voiceError("permission_timeout", error)
          : microphoneVoiceError(error),
        sessionId
      );
      return false;
    }

    if (sessionId !== this.sessionId) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    try {
      const engine = this.createEngine({
        stream,
        deviceId,
        onFailure: (error) => this.fail(voiceError("recorder_failed", error), sessionId),
      });
      this.engine = engine;
      engine.start();
      const startedAt = Date.now();
      this.publish({
        state: "recording",
        error: null,
        deviceId,
        startedAt,
        durationMs: 0,
        level: 0,
        stream,
        activeOwnerId: options.ownerId,
      });
      this.durationTimer = setInterval(() => {
        if (sessionId === this.sessionId && this.snapshot.startedAt) {
          this.transition({ durationMs: Date.now() - this.snapshot.startedAt });
        }
      }, 250);
      if (options.maxDurationMs) {
        this.maxDurationTimer = setTimeout(() => {
          void this.stop().catch(() => undefined);
        }, options.maxDurationMs);
      }
      return true;
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      this.fail(voiceError("recorder_unsupported_mimetype", error), sessionId);
      return false;
    }
  }

  async stop(ownerId?: string): Promise<SttResult | null> {
    if (!this.isOwnedBy(ownerId)) return null;
    if (this.snapshot.state === "transcribing" || this.snapshot.state === "finalizing") return null;
    if (this.snapshot.state !== "recording" || !this.engine) return null;

    const sessionId = this.sessionId;
    const engine = this.engine;
    const activeOwnerId = this.snapshot.activeOwnerId;
    const adapter = this.activeAdapter;
    const onResult = this.activeOnResult;
    this.clearTimers();
    this.transition({ state: "finalizing" });

    let artifact;
    try {
      artifact = await engine.stop();
    } catch (error) {
      this.fail(voiceError("recorder_failed", error), sessionId);
      throw error;
    }
    if (sessionId !== this.sessionId) return null;
    this.releaseEngine();
    if (!artifact) {
      const error = voiceError("no_audio_captured");
      this.fail(error, sessionId);
      throw error;
    }
    if (!adapter) {
      const error = voiceError("provider_not_configured");
      this.fail(error, sessionId);
      throw error;
    }

    this.abortController = new AbortController();
    this.publish({ ...this.snapshot, state: "transcribing", stream: null, activeOwnerId });
    try {
      const result = await adapter.transcribe(artifact, { signal: this.abortController.signal });
      if (sessionId !== this.sessionId || this.abortController.signal.aborted) return null;
      if (!result.text.trim()) {
        // Let the common catch path transition to the error state exactly once.
        throw voiceError("provider_returned_no_text");
      }
      this.reset();
      onResult?.(result);
      return result;
    } catch (error) {
      if (sessionId !== this.sessionId) return null;
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      const mapped = isAbort ? voiceError("stt_aborted", error) : this.asVoiceError(error);
      this.fail(mapped, sessionId);
      throw mapped;
    }
  }

  cancel(ownerId?: string) {
    if (!this.isOwnedBy(ownerId)) return;
    if (this.snapshot.state === "idle") return;

    const engine = this.engine;
    ++this.sessionId;
    this.clearTimers();
    this.abortController?.abort();
    this.abortController = null;
    this.activeAdapter = null;
    this.activeOnResult = undefined;
    this.engine = null;
    this.publish(IDLE_SNAPSHOT);
    if (engine) {
      void engine.cancel().finally(() => engine.releaseTracks());
    }
  }

  dispose() {
    this.cancel();
    this.listeners.clear();
  }
}

export const voiceRecorderController = new VoiceRecorderController();
