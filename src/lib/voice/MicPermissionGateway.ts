import { microphoneConstraints } from "@/lib/voice-recorder.utils";

export class MicPermissionTimeoutError extends Error {
  constructor() {
    super("Microphone permission request timed out.");
    this.name = "MicPermissionTimeoutError";
  }
}

function isDeviceConstraintError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "OverconstrainedError" || error.name === "NotFoundError")
  );
}

/** Keeps late getUserMedia resolutions from leaking a stream after a timeout. */
export class MicPermissionGateway {
  async request(deviceId?: string, timeoutMs = 30_000): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new DOMException("Microphone access is not available.", "NotFoundError");
      console.error("[MicPermission] getUserMedia not available:", error);
      throw error;
    }

    console.log("[MicPermission] Requesting microphone permission", { deviceId, timeoutMs });

    try {
      const stream = await this.requestWithConstraints(microphoneConstraints(deviceId), timeoutMs);
      console.log("[MicPermission] Successfully obtained microphone stream", {
        deviceId,
        trackCount: stream.getTracks().length,
        tracks: stream.getTracks().map(t => ({ id: t.id, kind: t.kind, label: t.label, enabled: t.enabled, readyState: t.readyState }))
      });
      return stream;
    } catch (error) {
      console.error("[MicPermission] Failed to obtain microphone permission", { deviceId, error });
      if (deviceId && isDeviceConstraintError(error)) {
        console.log("[MicPermission] Retrying without device constraint");
        return this.requestWithConstraints(microphoneConstraints(), timeoutMs);
      }
      throw error;
    }
  }

  private async requestWithConstraints(
    constraints: MediaStreamConstraints,
    timeoutMs: number
  ): Promise<MediaStream> {
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    
    console.log("[MicPermission] Requesting getUserMedia with constraints:", JSON.stringify(constraints));
    const streamRequest = navigator.mediaDevices.getUserMedia(constraints);
    
    streamRequest
      .then((stream) => {
        if (timedOut) {
          console.warn("[MicPermission] Stream arrived after timeout, stopping tracks");
          stream.getTracks().forEach((track) => track.stop());
        }
      })
      .catch((error) => {
        console.error("[MicPermission] getUserMedia promise rejected:", {
          name: error?.name,
          message: error?.message,
          constraint: error?.constraint
        });
      });

    const timeoutRequest = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
        console.error("[MicPermission] Permission request timed out after", timeoutMs, "ms");
        reject(new MicPermissionTimeoutError());
      }, timeoutMs);
    });

    try {
      return await Promise.race([streamRequest, timeoutRequest]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
