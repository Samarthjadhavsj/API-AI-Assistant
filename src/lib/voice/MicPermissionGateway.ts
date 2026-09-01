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
      throw new DOMException("Microphone access is not available.", "NotFoundError");
    }

    try {
      return await this.requestWithConstraints(microphoneConstraints(deviceId), timeoutMs);
    } catch (error) {
      if (deviceId && isDeviceConstraintError(error)) {
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
    const streamRequest = navigator.mediaDevices.getUserMedia(constraints);
    streamRequest
      .then((stream) => {
        if (timedOut) stream.getTracks().forEach((track) => track.stop());
      })
      .catch(() => undefined);

    const timeoutRequest = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
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
