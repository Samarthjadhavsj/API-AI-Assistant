import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "./Input";

const mocked = vi.hoisted(() => ({
  voice: null as any,
  voiceOptions: null as any,
  invoke: vi.fn(async () => undefined),
}));

vi.mock("@/components", () => ({
  Popover: ({ children }: any) => <>{children}</>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
  PopoverAnchor: ({ children }: any) => <>{children}</>,
  Button: ({ children }: any) => <button>{children}</button>,
  ScrollArea: ({ children }: any) => <>{children}</>,
  Markdown: ({ children }: any) => <>{children}</>,
  Switch: () => null,
  CopyButton: () => null,
}));
vi.mock("@/components/ui/popover", () => ({
  TransparentPopoverContent: ({ children }: any) => <>{children}</>,
}));
vi.mock("./MessageHistory", () => ({ MessageHistory: () => null }));
vi.mock("./VoiceInputBar", () => ({
  VoiceInputBar: ({ state, isProcessing, onMicClick, onCancel, onConfirm, errorMessage, transcript }: any) => (
    <>
      <span data-testid="voice-status">{isProcessing ? "Processing..." : state}</span>
      <span data-testid="voice-error">{errorMessage}</span>
      <span data-testid="voice-transcript">{transcript}</span>
      <button onClick={onMicClick}>mic</button>
      <button disabled={isProcessing} onClick={onCancel}>cancel</button>
      <button disabled={isProcessing} onClick={onConfirm}>confirm</button>
    </>
  ),
}));
vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: (options: any) => {
    mocked.voiceOptions = options;
    return mocked.voice;
  },
}));
vi.mock("@/contexts", () => ({
  useApp: () => ({
    selectedAudioDevices: {},
    selectedSttProvider: { variables: { api_key: "test-key" } },
  }),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocked.invoke }));

const completionProps: any = {
  isPopoverOpen: false,
  isLoading: false,
  reset: vi.fn(),
  input: "",
  setInput: vi.fn(),
  handleKeyPress: vi.fn(),
  handlePaste: vi.fn(),
  currentConversationId: null,
  conversationHistory: [],
  startNewConversation: vi.fn(),
  messageHistoryOpen: false,
  setMessageHistoryOpen: vi.fn(),
  error: null,
  response: "",
  cancel: vi.fn(),
  scrollAreaRef: createRef(),
  inputRef: createRef(),
  isHidden: false,
  keepEngaged: false,
  setKeepEngaged: vi.fn(),
};

function voiceSnapshot(state: string, text = "fresh transcript") {
  return {
    state,
    stream: null,
    start: vi.fn(async () => true),
    stop: vi.fn(async () => ({ text })),
    cancel: vi.fn(),
  };
}

describe("Input voice lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.voice = voiceSnapshot("idle");
    mocked.voiceOptions = null;
  });

  it("does not cancel an active session when the voice snapshot changes", async () => {
    const firstSnapshot = mocked.voice;
    const { rerender, unmount } = render(<Input {...completionProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "mic" }));
    });

    const activeSnapshot = voiceSnapshot("requestingPermission");
    mocked.voice = activeSnapshot;
    rerender(<Input {...completionProps} />);

    expect(firstSnapshot.cancel).not.toHaveBeenCalled();
    expect(activeSnapshot.cancel).not.toHaveBeenCalled();

    unmount();
    expect(activeSnapshot.cancel).toHaveBeenCalledOnce();
  });

  it("puts the completed stop result into the input", async () => {
    const setInput = vi.fn();
    const recordingSnapshot = voiceSnapshot("recording", "  final words  ");
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} setInput={setInput} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    });

    expect(recordingSnapshot.stop).toHaveBeenCalledOnce();
    expect(setInput).toHaveBeenCalledWith("final words");
  });

  it("stores live partial transcripts without changing the final input", () => {
    render(<Input {...completionProps} />);

    act(() => {
      mocked.voiceOptions.onPartial("words in progress");
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("words in progress");
    expect(completionProps.setInput).not.toHaveBeenCalled();
  });

  it("keeps cancel separate from confirmation and discards the transcript", async () => {
    const recordingSnapshot = voiceSnapshot("recording");
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    });

    expect(recordingSnapshot.cancel).toHaveBeenCalledOnce();
    expect(recordingSnapshot.stop).not.toHaveBeenCalled();
  });

  it("waits for a pending permission request before confirmation stops recording", async () => {
    let resolveStart: (started: boolean) => void;
    const startPromise = new Promise<boolean>((resolve) => {
      resolveStart = resolve;
    });
    const pendingSnapshot = voiceSnapshot("requestingPermission", "final transcript");
    pendingSnapshot.start = vi.fn(() => startPromise);
    mocked.voice = pendingSnapshot;
    render(<Input {...completionProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "mic" }));
      await Promise.resolve();
    });
    expect(pendingSnapshot.start).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    expect(pendingSnapshot.stop).not.toHaveBeenCalled();

    await act(async () => {
      resolveStart!(true);
      await startPromise;
    });

    expect(pendingSnapshot.stop).toHaveBeenCalledOnce();
  });

  it("accepts only one confirmation while finalization is in progress", async () => {
    const setInput = vi.fn();
    let resolveStop: (result: { text: string }) => void;
    const stopPromise = new Promise<{ text: string }>((resolve) => {
      resolveStop = resolve;
    });
    const recordingSnapshot = voiceSnapshot("recording");
    recordingSnapshot.stop = vi.fn(() => stopPromise);
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} setInput={setInput} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    expect(screen.getByTestId("voice-status")).toHaveTextContent("Processing...");
    expect(screen.getByRole("button", { name: "confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "cancel" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(recordingSnapshot.stop).toHaveBeenCalledOnce();
    expect(recordingSnapshot.cancel).not.toHaveBeenCalled();

    await act(async () => {
      resolveStop!({ text: "completed transcript" });
      await stopPromise;
    });

    expect(setInput).toHaveBeenCalledWith("completed transcript");
    expect(screen.getByTestId("voice-status")).toHaveTextContent("idle");
    expect(screen.getByRole("button", { name: "confirm" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "cancel" })).toBeEnabled();
  });

  it("returns to idle when final transcription fails", async () => {
    vi.useFakeTimers();
    let rejectStop: (error: Error) => void;
    const stopPromise = new Promise<never>((_, reject) => {
      rejectStop = reject;
    });
    const recordingSnapshot = voiceSnapshot("recording");
    recordingSnapshot.stop = vi.fn(() => stopPromise);
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    expect(screen.getByTestId("voice-status")).toHaveTextContent("Processing...");

    await act(async () => {
      rejectStop!(new Error("transcription failed"));
      await stopPromise.catch(() => undefined);
    });

    expect(screen.getByTestId("voice-status")).toHaveTextContent("error");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("voice-status")).toHaveTextContent("idle");
    expect(screen.getByRole("button", { name: "confirm" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "cancel" })).toBeEnabled();
    vi.useRealTimers();
  });

  it("passes the quota error message through to VoiceInputBar errorMessage", async () => {
    vi.useFakeTimers();
    const quotaError = new Error(
      "Voice transcription quota exceeded. Try again later."
    );
    const recordingSnapshot = voiceSnapshot("recording");
    recordingSnapshot.stop = vi.fn().mockRejectedValue(quotaError);
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await act(async () => {
      await recordingSnapshot.stop().catch(() => undefined);
    });

    expect(screen.getByTestId("voice-status")).toHaveTextContent("error");
    expect(screen.getByTestId("voice-error")).toHaveTextContent(
      "Voice transcription quota exceeded. Try again later."
    );
    vi.useRealTimers();
  });

  it("falls back to the generic message when the error carries no text", async () => {
    vi.useFakeTimers();
    const recordingSnapshot = voiceSnapshot("recording");
    // Throw an error with an empty message to simulate unknown failures
    recordingSnapshot.stop = vi.fn().mockRejectedValue(new Error(""));
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await act(async () => {
      await recordingSnapshot.stop().catch(() => undefined);
    });

    expect(screen.getByTestId("voice-status")).toHaveTextContent("error");
    // voiceErrorMessage falls back to MESSAGES.unknown for errors with no message text
    expect(screen.getByTestId("voice-error")).toHaveTextContent(
      "Unable to start voice input. Please try again."
    );
    vi.useRealTimers();
  });

  it("does not replace a specific backend error message with the generic fallback", async () => {
    vi.useFakeTimers();
    const specificError = new Error("The audio file could not be decoded.");
    const recordingSnapshot = voiceSnapshot("recording");
    recordingSnapshot.stop = vi.fn().mockRejectedValue(specificError);
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await act(async () => {
      await recordingSnapshot.stop().catch(() => undefined);
    });

    expect(screen.getByTestId("voice-error")).toHaveTextContent(
      "The audio file could not be decoded."
    );
    expect(screen.getByTestId("voice-error")).not.toHaveTextContent("Couldn't process voice");
    vi.useRealTimers();
  });

  it("shows 'No speech detected' for silent/no-transcript results", async () => {
    vi.useFakeTimers();
    const noSpeechError = { code: "no_speech_detected", message: "No speech detected. Please try again." };
    const recordingSnapshot = voiceSnapshot("recording");
    recordingSnapshot.stop = vi.fn().mockRejectedValue(noSpeechError);
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await act(async () => {
      await recordingSnapshot.stop().catch(() => undefined);
    });

    expect(screen.getByTestId("voice-status")).toHaveTextContent("error");
    expect(screen.getByTestId("voice-error")).toHaveTextContent("No speech detected. Please try again.");
    vi.useRealTimers();
  });

  it("preserves quota error behavior", async () => {
    vi.useFakeTimers();
    const quotaError = new Error("Voice transcription quota exceeded. Try again later.");
    const recordingSnapshot = voiceSnapshot("recording");
    recordingSnapshot.stop = vi.fn().mockRejectedValue(quotaError);
    mocked.voice = recordingSnapshot;
    render(<Input {...completionProps} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await act(async () => {
      await recordingSnapshot.stop().catch(() => undefined);
    });

    expect(screen.getByTestId("voice-error")).toHaveTextContent("Voice transcription quota exceeded. Try again later.");
    vi.useRealTimers();
  });

  it("preserves successful transcription behavior", async () => {
    vi.useFakeTimers();
    const recordingSnapshot = voiceSnapshot("recording");
    recordingSnapshot.stop = vi.fn().mockResolvedValue({ text: "Hello world" });
    mocked.voice = recordingSnapshot;
    const setInput = vi.fn();
    render(<Input {...completionProps} setInput={setInput} />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await act(async () => {
      await recordingSnapshot.stop();
    });

    expect(setInput).toHaveBeenCalledWith("Hello world");
    expect(screen.getByTestId("voice-status")).toHaveTextContent("idle");
    vi.useRealTimers();
  });
});
