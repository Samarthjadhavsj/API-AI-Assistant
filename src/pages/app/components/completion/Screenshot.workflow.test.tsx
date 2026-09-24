import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ChatMessage } from "@/types/completion";
import { VoiceComposer } from "./VoiceInputButton";

// Real Radix popovers, and the real Screenshot, Files and Message History
// controls: the bug being guarded is which clicks the response popover treats
// as "outside" (and so dismisses, which resets the answer).
const voiceMock = vi.hoisted(() => ({
  state: "idle",
  onPartial: null as null | ((transcript: string) => void),
}));

vi.mock("@/components", async () => {
  const popover = await vi.importActual<typeof import("@/components/ui/popover")>(
    "@/components/ui/popover"
  );
  return {
    ...popover,
    Button: ({ children, variant: _v, size: _s, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    ScrollArea: ({ children }: any) => <div>{children}</div>,
    Markdown: ({ children }: any) => <span>{children}</span>,
    Badge: ({ children }: any) => <span>{children}</span>,
    Switch: () => null,
    CopyButton: () => null,
  };
});
vi.mock("./VoiceInputBar", () => ({
  VoiceInputBar: ({ inputValue, onInputChange, uiState, transcript, onMicClick }: any) => (
    <div data-voice-state={uiState}>
      <textarea
        aria-label="Message input"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
      />
      {uiState === "listening" && <p data-testid="live-transcript">{transcript}</p>}
      <button type="button" onClick={onMicClick}>
        Start voice input
      </button>
    </div>
  ),
}));
vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: (options: { onPartial: (t: string) => void }) => {
    voiceMock.onPartial = options.onPartial;
    return {
      state: voiceMock.state,
      stream: null,
      start: vi.fn(async () => {
        voiceMock.state = "recording";
        return true;
      }),
      stop: vi.fn(async () => ({ text: "" })),
      cancel: vi.fn(() => {
        voiceMock.state = "idle";
      }),
    };
  },
}));
vi.mock("@/contexts", () => ({
  useApp: () => ({
    selectedAudioDevices: {},
    selectedSttProvider: { variables: { api_key: "test-key" } },
  }),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
// Message History loads through useHistory, which reads from the lib barrel.
vi.mock("@/lib", () => ({
  getAllConversations: vi.fn(async () => []),
  deleteConversation: vi.fn(async () => true),
  deleteAllConversations: vi.fn(async () => undefined),
  DOWNLOAD_SUCCESS_DISPLAY_MS: 1000,
}));

beforeAll(() => {
  // Radix Popper measures its anchor.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

const ANSWER = "The capital of France is Paris.";

type File = { id: string; name: string; type: string; base64: string; size: number };
const image = (name: string): File => ({ id: name, name, type: "image/png", base64: "AAAA", size: 4 });

type HarnessProps = {
  reset: () => void;
  captureScreenshot: () => void;
  initialInput?: string;
  initialFiles?: File[];
  keepEngaged?: boolean;
  conversationHistory?: ChatMessage[];
};

/** Mirrors how useCompletion drives the composer, including what reset() clears. */
const Harness = ({
  reset: resetSpy,
  captureScreenshot: captureSpy,
  initialInput = "draft to keep",
  initialFiles = [],
  keepEngaged = false,
  conversationHistory = [],
}: HarnessProps) => {
  const [input, setInput] = useState(initialInput);
  const [response, setResponse] = useState(keepEngaged ? "" : ANSWER);
  const [attachedFiles, setAttachedFiles] = useState<File[]>(initialFiles);
  const [isFilesPopoverOpen, setIsFilesPopoverOpen] = useState(false);
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);

  const reset = () => {
    resetSpy();
    if (keepEngaged) return;
    setInput("");
    setResponse("");
    setAttachedFiles([]);
  };

  return (
    <>
      <button type="button">outside the input bar</button>
      <output data-testid="attachments">{attachedFiles.map((f) => f.name).join(",")}</output>
      <VoiceComposer
        {...({
          isPopoverOpen: response !== "" || keepEngaged,
          isLoading: false,
          reset,
          input,
          setInput,
          handleKeyPress: vi.fn(),
          handlePaste: vi.fn(),
          currentConversationId: keepEngaged ? "conv_1" : null,
          conversationHistory,
          pendingMessage: null,
          startNewConversation: vi.fn(),
          messageHistoryOpen,
          setMessageHistoryOpen,
          error: null,
          response,
          cancel: vi.fn(),
          scrollAreaRef: createRef(),
          inputRef: createRef(),
          keepEngaged,
          setKeepEngaged: vi.fn(),
          screenshotConfiguration: { mode: "manual", autoPrompt: "", enabled: true },
          attachedFiles,
          isScreenshotLoading: false,
          captureScreenshot: async () => {
            captureSpy();
            setAttachedFiles((prev) => [...prev, image(`screenshot_${prev.length + 1}.png`)]);
          },
          handleFileSelect: vi.fn(),
          removeFile: vi.fn(),
          onRemoveAllFiles: vi.fn(),
          isFilesPopoverOpen,
          setIsFilesPopoverOpen,
        } as any)}
        isHidden={false}
      />
    </>
  );
};

const answer = () => screen.queryByText(ANSWER);
const draft = () => screen.getByLabelText("Message input");
const attachments = () => screen.getByTestId("attachments").textContent;
const screenshotButton = () => screen.getByRole("button", { name: /Screenshot mode/ });
const attachButton = () => screen.getByRole("button", { name: "Attach files" });

describe("Screenshot and Attach with a visible answer", () => {
  let reset: Mock<() => void>;
  let captureScreenshot: Mock<() => void>;

  beforeEach(() => {
    reset = vi.fn<() => void>();
    captureScreenshot = vi.fn<() => void>();
    voiceMock.state = "idle";
    voiceMock.onPartial = null;
  });

  const renderHarness = (props: Partial<HarnessProps> = {}) =>
    render(<Harness reset={reset} captureScreenshot={captureScreenshot} {...props} />);

  it("clicking Screenshot keeps the answer", async () => {
    const user = userEvent.setup();
    renderHarness();
    expect(answer()).toBeInTheDocument();

    await user.click(screenshotButton());

    expect(captureScreenshot).toHaveBeenCalledTimes(1);
    expect(answer()).toBeInTheDocument();
    expect(attachments()).toBe("screenshot_1.png");
  });

  it("clicking Screenshot keeps the answer, the typed draft and existing attachments", async () => {
    const user = userEvent.setup();
    renderHarness({ initialFiles: [image("photo.png")] });

    await user.click(screenshotButton());

    expect(answer()).toBeInTheDocument();
    expect(draft()).toHaveValue("draft to keep");
    expect(attachments()).toBe("photo.png,screenshot_2.png");
  });

  it("clicking Attach keeps the answer, the typed draft and attachments", async () => {
    const user = userEvent.setup();
    renderHarness({ initialFiles: [image("photo.png")] });

    await user.click(attachButton());

    // With an attachment, Attach opens the attachments list
    expect(await screen.findByText("Attachments (1/6)")).toBeInTheDocument();
    expect(answer()).toBeInTheDocument();
    expect(draft()).toHaveValue("draft to keep");
    expect(attachments()).toBe("photo.png");
  });

  it("clicking Attach with no attachments (file picker) keeps the answer and draft", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(attachButton());

    expect(answer()).toBeInTheDocument();
    expect(draft()).toHaveValue("draft to keep");
  });

  it("Screenshot and Attach never call reset()", async () => {
    const user = userEvent.setup();
    renderHarness({ initialFiles: [image("photo.png")] });

    await user.click(screenshotButton());
    await user.click(attachButton());
    await user.click(await screen.findByRole("button", { name: "Close" }));
    await user.click(screenshotButton());

    expect(reset).not.toHaveBeenCalled();
    expect(answer()).toBeInTheDocument();
    expect(attachments()).toBe("photo.png,screenshot_2.png,screenshot_3.png");
  });

  it("a true outside click still closes and resets the answer", async () => {
    const user = userEvent.setup();
    renderHarness({ initialFiles: [image("photo.png")] });

    await user.click(screen.getByRole("button", { name: "outside the input bar" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(answer()).not.toBeInTheDocument();
  });

  it("Escape still closes and resets the answer", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.keyboard("{Escape}");

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("the mic and History controls keep the answer too", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "View Conversations" }));
    expect(await screen.findByText("Recent Conversations")).toBeInTheDocument();
    expect(answer()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start voice input" }));
    await waitFor(() => expect(screen.getByTestId("live-transcript")).toBeInTheDocument());

    expect(reset).not.toHaveBeenCalled();
    expect(answer()).toBeInTheDocument();
    expect(draft()).toHaveValue("draft to keep");
  });

  it("Screenshot with Message History open closes History but keeps the answer", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "View Conversations" }));
    expect(await screen.findByText("Recent Conversations")).toBeInTheDocument();

    await user.click(screenshotButton());

    await waitFor(() => expect(screen.queryByText("Recent Conversations")).not.toBeInTheDocument());
    expect(reset).not.toHaveBeenCalled();
    expect(answer()).toBeInTheDocument();
    expect(attachments()).toBe("screenshot_1.png");
  });
});

describe("Screenshot combinations", () => {
  let reset: Mock<() => void>;
  let captureScreenshot: Mock<() => void>;

  beforeEach(() => {
    reset = vi.fn<() => void>();
    captureScreenshot = vi.fn<() => void>();
    voiceMock.state = "idle";
    voiceMock.onPartial = null;
  });

  it("Screenshot while the mic is listening keeps the live transcript", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} captureScreenshot={captureScreenshot} />);

    await user.click(screen.getByRole("button", { name: "Start voice input" }));
    await waitFor(() => expect(screen.getByTestId("live-transcript")).toBeInTheDocument());
    act(() => voiceMock.onPartial?.("what is on my screen"));
    expect(screen.getByTestId("live-transcript")).toHaveTextContent("what is on my screen");

    await user.click(screenshotButton());

    expect(captureScreenshot).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("live-transcript")).toHaveTextContent("what is on my screen");
    expect(attachments()).toBe("screenshot_1.png");
    expect(answer()).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("existing attachments stay, in order, as more screenshots are added", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        reset={reset}
        captureScreenshot={captureScreenshot}
        initialFiles={[image("a.png"), image("b.png")]}
      />
    );

    await user.click(screenshotButton());
    await user.click(screenshotButton());

    expect(attachments()).toBe("a.png,b.png,screenshot_3.png,screenshot_4.png");
  });

  it("conversation mode is unaffected by Screenshot", async () => {
    const user = userEvent.setup();
    const history: ChatMessage[] = [
      { id: "q1", role: "user", content: "Earlier question", timestamp: 1_000 },
      { id: "a1", role: "assistant", content: "Earlier answer", timestamp: 1_001 },
    ];
    render(
      <Harness
        reset={reset}
        captureScreenshot={captureScreenshot}
        keepEngaged
        conversationHistory={history}
      />
    );
    expect(screen.getByText("Conversation Mode")).toBeInTheDocument();

    await user.click(screenshotButton());

    expect(screen.getByText("Conversation Mode")).toBeInTheDocument();
    expect(screen.getByText("Earlier question")).toBeInTheDocument();
    expect(screen.getByText("Earlier answer")).toBeInTheDocument();
    expect(draft()).toHaveValue("draft to keep");
    expect(attachments()).toBe("screenshot_1.png");
    expect(reset).not.toHaveBeenCalled();
  });
});
