import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ChatConversation } from "@/types/completion";
import { Input } from "./Input";

// Real Radix popovers are used on purpose: the bug being guarded is in how the
// response popover's trigger/anchor and dismiss boundary are wired.
const mocked = vi.hoisted(() => ({
  conversations: [] as any[],
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
  VoiceInputBar: ({ inputValue, onInputChange }: any) => (
    <div>
      <textarea
        aria-label="Message input"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <button type="button">attach</button>
    </div>
  ),
}));
vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    state: "idle",
    stream: null,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
  }),
}));
vi.mock("@/contexts", () => ({
  useApp: () => ({ selectedAudioDevices: {}, selectedSttProvider: { variables: {} } }),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
// Message History loads through useHistory, which reads from the lib barrel.
vi.mock("@/lib", () => ({
  getAllConversations: vi.fn(async () => mocked.conversations),
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

const pastConversation: ChatConversation = {
  id: "conv_past",
  title: "Earlier chat",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  messages: [
    { id: "m1", role: "user", content: "Earlier question", timestamp: 1_700_000_000_000 },
    { id: "m2", role: "assistant", content: "Earlier answer", timestamp: 1_700_000_000_001 },
  ],
};

/** Mirrors how useCompletion drives Input: response state + history open state. */
const Harness = ({ reset, setMessageHistoryOpenSpy }: { reset: () => void; setMessageHistoryOpenSpy?: (open: boolean) => void }) => {
  const [input, setInput] = useState("draft to keep");
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);
  return (
    <>
      <button type="button">outside the input bar</button>
      <Input
        {...({
          isPopoverOpen: true,
          isLoading: false,
          reset,
          input,
          setInput,
          handleKeyPress: vi.fn(),
          handlePaste: vi.fn(),
          currentConversationId: null,
          conversationHistory: [],
          startNewConversation: vi.fn(),
          messageHistoryOpen,
          setMessageHistoryOpen: (open: boolean) => {
            setMessageHistoryOpenSpy?.(open);
            setMessageHistoryOpen(open);
          },
          error: null,
          response: "The capital of France is Paris.",
          cancel: vi.fn(),
          scrollAreaRef: createRef(),
          inputRef: createRef(),
          isHidden: false,
          keepEngaged: false,
          setKeepEngaged: vi.fn(),
        } as any)}
      />
    </>
  );
};

describe("Input response popover", () => {
  let reset: Mock<() => void>;

  beforeEach(() => {
    reset = vi.fn<() => void>();
    mocked.conversations = [pastConversation];
  });

  const responsePanel = () =>
    screen.queryByText("The capital of France is Paris.");

  it("opening Message History does not reset the response or clear the input", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);
    expect(responsePanel()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Conversations" }));

    expect(await screen.findByText("Recent Conversations")).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
    expect(responsePanel()).toBeInTheDocument();
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep");
  });

  it("clicking, focusing and typing in the input does not reset the response", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    const textbox = screen.getByLabelText("Message input");
    await user.click(textbox);
    await user.type(textbox, " more");
    await user.click(screen.getByRole("button", { name: "attach" }));

    expect(reset).not.toHaveBeenCalled();
    expect(responsePanel()).toBeInTheDocument();
    expect(textbox).toHaveValue("draft to keep more");
  });

  it("still closes the response on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.keyboard("{Escape}");

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("still closes the response when interacting outside the input bar", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.click(screen.getByRole("button", { name: "outside the input bar" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("still clears the response from the panel's close button", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Clear conversation" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("browsing a conversation in Message History, then Continue chat, loads it", async () => {
    const user = userEvent.setup();
    const setMessageHistoryOpenSpy = vi.fn();
    const selected = vi.fn();
    window.addEventListener("conversationSelected", selected);
    render(<Harness reset={reset} setMessageHistoryOpenSpy={setMessageHistoryOpenSpy} />);

    await user.click(screen.getByRole("button", { name: "View Conversations" }));
    const history = (await screen.findByText("Recent Conversations")).closest(
      "[data-slot=transparent-popover-content]"
    ) as HTMLElement;
    await user.click(await within(history).findByText("Earlier chat"));

    // Reading the Q&A leaves the current response and draft alone
    expect(await within(history).findByText("Earlier answer")).toBeInTheDocument();
    expect(responsePanel()).toBeInTheDocument();
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep");
    expect(selected).not.toHaveBeenCalled();

    await user.click(within(history).getByRole("button", { name: "Continue chat" }));

    await waitFor(() => expect(selected).toHaveBeenCalledTimes(1));
    expect((selected.mock.calls[0][0] as CustomEvent).detail).toEqual({ id: "conv_past" });
    expect(setMessageHistoryOpenSpy).toHaveBeenLastCalledWith(false);
    expect(reset).not.toHaveBeenCalled();
    window.removeEventListener("conversationSelected", selected);
  });
});
