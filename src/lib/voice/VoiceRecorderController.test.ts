import { describe, expect, it, vi } from "vitest";
import { VoiceRecorderController } from "./VoiceRecorderController";
import { AudioArtifact, SttAdapter, SttResult } from "./types";

function fakeStream() {
  const stop = vi.fn();
  return {
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
    stop,
  };
}

function fakeArtifact(): AudioArtifact {
  return {
    blob: new Blob(["audio"], { type: "audio/webm" }),
    mimeType: "audio/webm",
    durationMs: 500,
    sizeBytes: 5,
    deviceId: null,
    chunkCount: 1,
  };
}

function fakeAdapter(result: SttResult = { text: "hello", providerId: "test" }): SttAdapter {
  return {
    kind: "multipart",
    providerId: "test",
    transcribe: vi.fn(async () => result),
  };
}

describe("VoiceRecorderController", () => {
  it("fails closed when no STT adapter is configured", async () => {
    const controller = new VoiceRecorderController();
    const started = await controller.start({
      adapter: null,
      ownerId: "overlay",
    });

    expect(started).toBe(false);
    expect(controller.getSnapshot().state).toBe("error");
    expect(controller.getSnapshot().error?.code).toBe("provider_not_configured");
    expect(controller.getSnapshot().activeOwnerId).toBe("overlay");
  });

  it("rejects a second start while a session is already active", async () => {
    const { stream } = fakeStream();
    let releasePermission: ((value: MediaStream) => void) | undefined;
    const controller = new VoiceRecorderController({
      request: () =>
        new Promise<MediaStream>((resolve) => {
          releasePermission = resolve;
        }),
    });

    const first = controller.start({
      adapter: fakeAdapter(),
      ownerId: "overlay",
    });
    await Promise.resolve();
    expect(controller.getSnapshot().state).toBe("requestingPermission");

    await expect(
      controller.start({ adapter: fakeAdapter(), ownerId: "chat" })
    ).rejects.toMatchObject({ code: "recording_already_active" });

    releasePermission?.(stream);
    await first;
    controller.dispose();
  });

  it("does not leak a late permission stream after cancel", async () => {
    const { stream, stop } = fakeStream();
    let releasePermission: ((value: MediaStream) => void) | undefined;
    const controller = new VoiceRecorderController({
      request: () =>
        new Promise<MediaStream>((resolve) => {
          releasePermission = resolve;
        }),
    });

    const startPromise = controller.start({
      adapter: fakeAdapter(),
      ownerId: "overlay",
    });
    await Promise.resolve();
    controller.cancel("overlay");
    releasePermission?.(stream);
    await expect(startPromise).resolves.toBe(false);
    expect(stop).toHaveBeenCalled();
    expect(controller.getSnapshot().state).toBe("idle");
  });

  it("records, transcribes, and returns a result for the owning surface", async () => {
    const { stream, stop } = fakeStream();
    const adapter = fakeAdapter();
    const engine = {
      stream,
      start: vi.fn(),
      stop: vi.fn(async () => fakeArtifact()),
      cancel: vi.fn(async () => undefined),
      releaseTracks: vi.fn(() => stream.getTracks().forEach((track) => track.stop())),
    };
    const controller = new VoiceRecorderController(
      { request: async () => stream },
      () => engine
    );
    const onResult = vi.fn();

    const started = await controller.start({
      adapter,
      ownerId: "overlay",
      onResult,
    });
    expect(started).toBe(true);
    expect(controller.getSnapshot().state).toBe("recording");
    expect(engine.start).toHaveBeenCalled();

    const result = await controller.stop("overlay");
    expect(result?.text).toBe("hello");
    expect(onResult).toHaveBeenCalledWith(result);
    expect(controller.getSnapshot().state).toBe("idle");
    expect(engine.releaseTracks).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it("does not treat an empty provider transcript as success", async () => {
    const { stream } = fakeStream();
    const engine = {
      stream,
      start: vi.fn(),
      stop: vi.fn(async () => fakeArtifact()),
      cancel: vi.fn(async () => undefined),
      releaseTracks: vi.fn(),
    };
    const controller = new VoiceRecorderController(
      { request: async () => stream },
      () => engine
    );

    await controller.start({
      adapter: fakeAdapter({ text: "  ", providerId: "test" }),
      ownerId: "overlay",
    });

    await expect(controller.stop("overlay")).rejects.toMatchObject({
      code: "provider_returned_no_text",
    });
    expect(controller.getSnapshot().state).toBe("error");
    expect(controller.getSnapshot().error?.code).toBe("provider_returned_no_text");
  });

  it("ignores stop and cancel from a surface that does not own the session", async () => {
    const { stream } = fakeStream();
    const engine = {
      stream,
      start: vi.fn(),
      stop: vi.fn(async () => fakeArtifact()),
      cancel: vi.fn(async () => undefined),
      releaseTracks: vi.fn(),
    };
    const controller = new VoiceRecorderController(
      { request: async () => stream },
      () => engine
    );

    await controller.start({ adapter: fakeAdapter(), ownerId: "overlay" });
    await expect(controller.stop("chat")).resolves.toBeNull();
    controller.cancel("chat");
    expect(controller.getSnapshot().state).toBe("recording");
    expect(engine.stop).not.toHaveBeenCalled();

    controller.dispose();
  });
});
