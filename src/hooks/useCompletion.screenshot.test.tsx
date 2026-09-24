import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useCompletion } from "./useCompletion";

type Handler = (event: { payload: unknown }) => unknown;

// A live Tauri event registry: listeners really subscribe and unsubscribe, so
// the tests can count what is still attached.
const tauri = vi.hoisted(() => ({
  handlers: new Map<string, Set<Handler>>(),
  screenshotConfig: { mode: "manual", autoPrompt: "Describe this", enabled: true },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, handler: Handler) => {
    const set = tauri.handlers.get(name) ?? new Set<Handler>();
    set.add(handler);
    tauri.handlers.set(name, set);
    return () => {
      set.delete(handler);
    };
  }),
}));
vi.mock("@/contexts", () => ({
  useApp: () => ({
    selectedAIProvider: { provider: "", variables: {} },
    allAiProviders: [],
    systemPrompt: "",
    screenshotConfiguration: tauri.screenshotConfig,
    setScreenshotConfiguration: vi.fn(),
  }),
}));
vi.mock("@/hooks", () => ({
  useGlobalShortcuts: () => ({
    registerAudioCallback: vi.fn(),
    registerInputRef: vi.fn(),
    registerScreenshotCallback: vi.fn(),
  }),
}));
vi.mock("@/hooks/useVoiceInput", () => ({ invokeVoiceShortcutToggle: vi.fn() }));
vi.mock("./useWindow", () => ({ useWindowResize: () => ({ resizeWindow: vi.fn() }) }));
vi.mock("@/lib", () => ({
  fetchAIResponse: vi.fn(),
  saveConversation: vi.fn(),
  getConversationById: vi.fn(),
  generateConversationTitle: vi.fn(() => "title"),
  MESSAGE_ID_OFFSET: 1,
  generateConversationId: vi.fn(() => "conv_1"),
  generateMessageId: vi.fn((role: string, t: number) => `${role}_${t}`),
  generateRequestId: vi.fn(() => "req_1"),
  getResponseSettings: vi.fn(() => ({ autoScroll: true })),
}));

const invokeMock = vi.mocked(invoke);

/** Native command results, per command; a function result is called (may throw). */
let commands: Record<string, unknown>;

const listenerCount = (name: string) => tauri.handlers.get(name)?.size ?? 0;

/** Emits a Tauri event to every attached listener and waits for them. */
const emit = (name: string, payload?: unknown) =>
  act(async () => {
    await Promise.all([...(tauri.handlers.get(name) ?? [])].map((h) => h({ payload })));
  });

const flush = () => act(async () => {});

const setup = async () => {
  const hook = renderHook(() => useCompletion());
  await flush(); // let the async listen() subscriptions resolve
  return hook;
};

const capture = (result: { current: ReturnType<typeof useCompletion> }) =>
  act(async () => {
    await result.current.captureScreenshot();
  });

describe("useCompletion screenshot loading state", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tauri.handlers.clear();
    tauri.screenshotConfig = { mode: "manual", autoPrompt: "Describe this", enabled: true };
    commands = {
      capture_to_base64: "FULL_SCREEN_PNG",
      start_screen_capture: undefined,
      close_overlay_window: undefined,
    };
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string) => {
      const result = commands[cmd];
      return typeof result === "function" ? result() : result;
    });
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("full-screen capture success attaches the image and clears loading", async () => {
    const { result } = await setup();

    await capture(result);

    expect(invokeMock).toHaveBeenCalledWith("capture_to_base64");
    expect(result.current.isScreenshotLoading).toBe(false);
    expect(result.current.attachedFiles.map((f) => f.base64)).toEqual(["FULL_SCREEN_PNG"]);
    expect(result.current.error).toBeNull();
  });

  it("full-screen capture error clears loading and shows a friendly error", async () => {
    commands.capture_to_base64 = () => {
      throw new Error("xcap: monitor not found");
    };
    const { result } = await setup();

    await capture(result);

    expect(result.current.isScreenshotLoading).toBe(false);
    expect(result.current.error).toBe("Failed to capture screenshot. Please try again.");
    expect(result.current.attachedFiles).toHaveLength(0);
    // Not swallowed silently
    expect(consoleError).toHaveBeenCalled();
  });

  describe("selection mode", () => {
    beforeEach(() => {
      tauri.screenshotConfig = { ...tauri.screenshotConfig, enabled: false };
    });

    it("keeps the spinner while the overlay is open, and clears it on capture-closed", async () => {
      const { result } = await setup();

      await capture(result);
      expect(invokeMock).toHaveBeenCalledWith("start_screen_capture");
      expect(result.current.isScreenshotLoading).toBe(true);

      await emit("capture-closed");

      expect(result.current.isScreenshotLoading).toBe(false);
      expect(result.current.attachedFiles).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("a selected area attaches the image and clears loading", async () => {
      const { result } = await setup();

      await capture(result);
      await emit("captured-selection", "SELECTED_AREA_PNG");

      expect(result.current.isScreenshotLoading).toBe(false);
      expect(result.current.attachedFiles.map((f) => f.base64)).toEqual(["SELECTED_AREA_PNG"]);
    });

    it("a failed start stops the spinner immediately, with a friendly error", async () => {
      commands.start_screen_capture = () => {
        throw "Failed to create overlay window 1: boom";
      };
      const { result } = await setup();

      await capture(result);

      expect(result.current.isScreenshotLoading).toBe(false);
      expect(result.current.error).toBe("Couldn't open screen selection. Please try again.");
      // Any overlay the failed start left open is closed
      expect(invokeMock).toHaveBeenCalledWith("close_overlay_window");
      expect(consoleError).toHaveBeenCalled();
    });

    it("a selection that arrives after a failed start is ignored", async () => {
      commands.start_screen_capture = () => {
        throw new Error("boom");
      };
      const { result } = await setup();

      await capture(result);
      await emit("captured-selection", "LATE_PNG");

      expect(result.current.attachedFiles).toHaveLength(0);
      expect(result.current.isScreenshotLoading).toBe(false);
    });
  });

  it("no stuck spinner after repeated attempts across success, cancel and failure", async () => {
    const { result, rerender } = await setup();
    // The hook reads the capture mode from app settings on render
    const setEnabled = (enabled: boolean) => {
      tauri.screenshotConfig = { ...tauri.screenshotConfig, enabled };
      rerender();
    };

    for (let round = 0; round < 3; round++) {
      // Full-screen success
      setEnabled(true);
      commands.capture_to_base64 = `PNG_${round}`;
      await capture(result);
      expect(result.current.isScreenshotLoading).toBe(false);

      // Full-screen failure
      commands.capture_to_base64 = () => {
        throw new Error("capture failed");
      };
      await capture(result);
      expect(result.current.isScreenshotLoading).toBe(false);

      // Selection cancelled
      setEnabled(false);
      commands.start_screen_capture = undefined;
      await capture(result);
      expect(result.current.isScreenshotLoading).toBe(true);
      await emit("capture-closed");
      expect(result.current.isScreenshotLoading).toBe(false);

      // Selection start failure
      commands.start_screen_capture = () => {
        throw new Error("start failed");
      };
      await capture(result);
      expect(result.current.isScreenshotLoading).toBe(false);
    }

    expect(result.current.attachedFiles.map((f) => f.base64)).toEqual(["PNG_0", "PNG_1", "PNG_2"]);
  });

  describe("listener cleanup", () => {
    it("keeps exactly one listener per event across success, cancel and failure", async () => {
      tauri.screenshotConfig = { ...tauri.screenshotConfig, enabled: false };
      const { result } = await setup();
      const expectOneEach = () => {
        expect(listenerCount("captured-selection")).toBe(1);
        expect(listenerCount("capture-closed")).toBe(1);
      };
      expectOneEach();

      // Success: the attachment count changes, which re-subscribes the listener
      await capture(result);
      await emit("captured-selection", "PNG");
      await flush();
      expectOneEach();

      // Cancel
      await capture(result);
      await emit("capture-closed");
      await flush();
      expectOneEach();

      // Failure
      commands.start_screen_capture = () => {
        throw new Error("start failed");
      };
      await capture(result);
      await flush();
      expectOneEach();

      // A stale listener would have attached the image twice
      expect(result.current.attachedFiles).toHaveLength(1);
    });

    it("removes every listener on unmount", async () => {
      const { unmount } = await setup();

      unmount();
      await flush();

      expect(listenerCount("captured-selection")).toBe(0);
      expect(listenerCount("capture-closed")).toBe(0);
    });

    it("removes listeners even when unmounted before they finished subscribing", async () => {
      const { unmount } = renderHook(() => useCompletion());

      unmount(); // listen() has not resolved yet
      await flush();

      expect(listenerCount("captured-selection")).toBe(0);
      expect(listenerCount("capture-closed")).toBe(0);
    });
  });

  it("adding a screenshot keeps the draft, the answer and existing attachments", async () => {
    const { result } = await setup();
    const existing = { id: "img_1", name: "photo.png", type: "image/png", base64: "PHOTO", size: 5 };
    act(() => {
      result.current.setState((prev) => ({
        ...prev,
        input: "my draft",
        response: "Visible answer",
        attachedFiles: [existing],
      }));
    });

    await capture(result);

    expect(result.current.input).toBe("my draft");
    expect(result.current.response).toBe("Visible answer");
    expect(result.current.attachedFiles[0]).toEqual(existing);
    expect(result.current.attachedFiles.map((f) => f.base64)).toEqual(["PHOTO", "FULL_SCREEN_PNG"]);
  });
});
