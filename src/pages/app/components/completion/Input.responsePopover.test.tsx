import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ChatMessage } from "@/types/completion";
import { Input } from "./Input";

// Real Radix popovers are used on purpose: the bug being guarded is in how the
// response popover's trigger/anchor and dismiss boundary are wired.
vi.mock("@/components", async () => {
  const popover = await vi.importActual<typeof import("@/components/ui/popover")>(
    "@/components/ui/popover"
  );
  return {
    ...popover,
    Button: ({ children, variant: _v, size: _s, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    // Radix's structure: the ref on the root, scrolling in the viewport inside it
    ScrollArea: ({ children, className, ref }: any) => (
      <div className={className} ref={ref}>
        <div data-radix-scroll-area-viewport="">{children}</div>
      </div>
    ),
    Markdown: ({ children }: any) => <span>{children}</span>,
    Badge: ({ children }: any) => <span>{children}</span>,
    Switch: () => null,
    CopyButton: () => null,
  };
});
vi.mock("./VoiceInputBar", () => ({
  VoiceInputBar: ({ inputValue, onInputChange, onKeyPress }: any) => (
    <div data-voice-state="idle">
      <textarea
        aria-label="Message input"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyPress}
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

beforeAll(() => {
  // jsdom keeps scrollTop but has no scrollTo/scrollBy; make them move it.
  HTMLElement.prototype.scrollTo = function (this: HTMLElement, options?: ScrollToOptions | number) {
    if (typeof options === "object" && typeof options.top === "number") this.scrollTop = options.top;
  } as any;
  HTMLElement.prototype.scrollBy = function (this: HTMLElement, options?: ScrollToOptions | number) {
    if (typeof options === "object" && typeof options.top === "number") this.scrollTop += options.top;
  } as any;
  // Radix Popper measures its anchor.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

const currentConversation: ChatMessage[] = [
  { id: "m1", role: "user", content: "Earlier question", timestamp: 1_700_000_000_000 },
  { id: "m2", role: "assistant", content: "Earlier answer", timestamp: 1_700_000_000_001 },
];

/** Mirrors how useCompletion drives Input: response state + history open state. */
const Harness = ({
  reset,
  setMessageHistoryOpenSpy,
  startNewConversation = vi.fn(),
  cancel = vi.fn(),
  isLoading = false,
  pendingMessage = null,
  response = "The capital of France is Paris.",
}: {
  reset: () => void;
  setMessageHistoryOpenSpy?: (open: boolean) => void;
  startNewConversation?: () => void;
  cancel?: () => void;
  isLoading?: boolean;
  pendingMessage?: ChatMessage | null;
  response?: string;
}) => {
  const [input, setInput] = useState("draft to keep");
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);
  return (
    // Message History links to Toggle Settings, so the composer needs a router.
    <MemoryRouter>
      <button type="button">outside the input bar</button>
      <Input
        {...({
          // As useCompletion: the answer panel is not shown while the drawer is open
          isPopoverOpen: !messageHistoryOpen,
          isLoading,
          reset,
          input,
          setInput,
          handleKeyPress: vi.fn(),
          handlePaste: vi.fn(),
          currentConversationId: "conv_current",
          conversationHistory: currentConversation,
          pendingMessage,
          startNewConversation,
          messageHistoryOpen,
          setMessageHistoryOpen: (open: boolean) => {
            setMessageHistoryOpenSpy?.(open);
            setMessageHistoryOpen(open);
          },
          error: null,
          response,
          cancel,
          scrollAreaRef: createRef(),
          inputRef: createRef(),
          isHidden: false,
          keepEngaged: false,
          setKeepEngaged: vi.fn(),
        } as any)}
      />
    </MemoryRouter>
  );
};

describe("Input response popover", () => {
  let reset: Mock<() => void>;

  beforeEach(() => {
    reset = vi.fn<() => void>();
  });

  const responsePanel = () =>
    screen.queryByText("The capital of France is Paris.");

  it("opening Message History does not reset the response or clear the input", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);
    expect(responsePanel()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Message History" }));

    expect(await screen.findByRole("dialog", { name: "Current conversation" })).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
    // The drawer is the only surface while open; the answer is kept, not shown
    expect(responsePanel()).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(responsePanel()).toBeInTheDocument());
    expect(reset).not.toHaveBeenCalled();
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

  const historyDrawer = () => screen.queryByRole("dialog", { name: "Current conversation" });

  it("shows the current conversation over the answer, and closing keeps answer and draft", async () => {
    const user = userEvent.setup();
    const setMessageHistoryOpenSpy = vi.fn();
    const startNewConversation = vi.fn();
    render(
      <Harness
        reset={reset}
        setMessageHistoryOpenSpy={setMessageHistoryOpenSpy}
        startNewConversation={startNewConversation}
      />
    );

    await user.click(screen.getByRole("button", { name: "Message History" }));
    const history = await screen.findByRole("dialog", { name: "Current conversation" });
    const transcript = within(history).getByRole("list", { name: "Conversation" });
    expect(within(transcript).getByText("Earlier question")).toBeInTheDocument();
    expect(within(transcript).getByText("Earlier answer")).toBeInTheDocument();
    expect(responsePanel()).not.toBeInTheDocument(); // one surface at a time

    await user.click(within(history).getByRole("button", { name: "Close Message History" }));

    await waitFor(() => expect(historyDrawer()).not.toBeInTheDocument());
    expect(setMessageHistoryOpenSpy).toHaveBeenLastCalledWith(false);
    expect(reset).not.toHaveBeenCalled();
    expect(startNewConversation).not.toHaveBeenCalled();
    expect(responsePanel()).toBeInTheDocument();
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep");
  });

  it("Escape closes only Message History, keeping the answer and draft", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Message History" }));
    await screen.findByRole("dialog", { name: "Current conversation" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(historyDrawer()).not.toBeInTheDocument());
    expect(reset).not.toHaveBeenCalled();
    expect(responsePanel()).toBeInTheDocument();
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep");
  });

  it("clicking the input bar keeps Message History open, resetting nothing", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Message History" }));
    const drawer = await screen.findByRole("dialog", { name: "Current conversation" });
    await user.click(screen.getByLabelText("Message input"));

    await new Promise((r) => setTimeout(r, 50));
    expect(historyDrawer()).toBe(drawer);
    expect(reset).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep");
  });

  it("clicking a button in the voice bar (e.g. the mic) still closes Message History", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Message History" }));
    await screen.findByRole("dialog", { name: "Current conversation" });
    await user.click(screen.getByRole("button", { name: "attach" })); // a button inside the voice bar

    await waitFor(() => expect(historyDrawer()).not.toBeInTheDocument());
    expect(reset).not.toHaveBeenCalled();
  });

  it("focus returning to the input (as after each answer) keeps Message History open", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Message History" }));
    await screen.findByRole("dialog", { name: "Current conversation" });
    act(() => (screen.getByLabelText("Message input") as HTMLTextAreaElement).focus());

    await new Promise((r) => setTimeout(r, 50));
    expect(historyDrawer()).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("focus moving anywhere else still closes Message History", async () => {
    const user = userEvent.setup();
    render(<Harness reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Message History" }));
    await screen.findByRole("dialog", { name: "Current conversation" });
    act(() => screen.getByRole("button", { name: "outside the input bar" }).focus());

    await waitFor(() => expect(historyDrawer()).not.toBeInTheDocument());
  });

  describe("while an answer is generating", () => {
    const question: ChatMessage = {
      id: "pending_1",
      role: "user",
      content: "And the capital of Spain?",
      timestamp: 1_700_000_100_000,
    };

    it("hides Message History, as before, unless it is already open", () => {
      render(<Harness reset={reset} isLoading pendingMessage={question} response="" />);

      expect(screen.queryByRole("button", { name: "Message History" })).not.toBeInTheDocument();
    });

    it("hides the closed Message History without unmounting it, so it keeps its reading position", () => {
      const { rerender } = render(<Harness reset={reset} />);
      const icon = screen.getByRole("button", { name: "Message History" });

      rerender(<Harness reset={reset} isLoading pendingMessage={question} response="" />);
      expect(screen.queryByRole("button", { name: "Message History" })).not.toBeInTheDocument();
      expect(icon.closest("[aria-hidden='true']")).not.toBeNull();

      rerender(<Harness reset={reset} />);
      // The very same element comes back: nothing was remounted
      expect(screen.getByRole("button", { name: "Message History" })).toBe(icon);
    });

    it("keeps the hidden icon's slot in the layout (no reflow of the composer or mic), out of reach", () => {
      const { rerender } = render(<Harness reset={reset} />);
      const slot = screen.getByRole("button", { name: "Message History" }).parentElement!;
      const siblingsBefore = Array.from(slot.parentElement!.children);
      expect(slot).not.toHaveClass("invisible");
      expect(slot).not.toHaveAttribute("aria-hidden");
      expect(slot).not.toHaveAttribute("inert");

      rerender(<Harness reset={reset} isLoading pendingMessage={question} response="" />);
      // visibility:hidden (keeps its box), never display:none
      expect(slot).not.toHaveAttribute("hidden");
      expect(slot).toHaveClass("invisible", "relative", "mt-1", "shrink-0");
      expect(slot.style.display).toBe("");
      expect(Array.from(slot.parentElement!.children)).toEqual(siblingsBefore);
      // Unavailable: not announced, not focusable or clickable
      expect(slot).toHaveAttribute("aria-hidden", "true");
      expect(slot).toHaveAttribute("inert");

      rerender(<Harness reset={reset} />);
      expect(slot).not.toHaveClass("invisible");
      expect(slot).not.toHaveAttribute("aria-hidden");
      expect(slot).not.toHaveAttribute("inert");
    });

    it("an open Message History stays open and shows the new question on top, its answer streaming under it", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness reset={reset} />);
      await user.click(screen.getByRole("button", { name: "Message History" }));
      await screen.findByRole("dialog", { name: "Current conversation" });

      rerender(<Harness reset={reset} isLoading pendingMessage={question} response="Madrid" />);

      const history = screen.getByRole("dialog", { name: "Current conversation" });
      const items = within(history)
        .getAllByRole("listitem")
        .filter((li) => li.hasAttribute("data-role"));
      expect(items.map((li) => li.textContent?.replace(/\d{1,2}:\d{2}\s*[AP]M/i, ""))).toEqual([
        // Newest first: the question just sent, its answer streaming under it
        "YouAnd the capital of Spain?",
        "AIMadrid",
        "YouEarlier question",
        "AIEarlier answer",
      ]);
      expect(reset).not.toHaveBeenCalled();
    });

    it("New chat stops the streaming answer before starting the new chat", async () => {
      const user = userEvent.setup();
      const calls: string[] = [];
      const cancel = vi.fn(() => calls.push("cancel"));
      const startNewConversation = vi.fn(() => calls.push("new chat"));
      const { rerender } = render(
        <Harness reset={reset} cancel={cancel} startNewConversation={startNewConversation} />
      );
      await user.click(screen.getByRole("button", { name: "Message History" }));
      await screen.findByRole("dialog", { name: "Current conversation" });
      rerender(
        <Harness
          reset={reset}
          cancel={cancel}
          startNewConversation={startNewConversation}
          isLoading
          pendingMessage={question}
          response="Mad"
        />
      );

      await user.click(screen.getByRole("button", { name: "New chat" }));

      expect(calls).toEqual(["cancel", "new chat"]);
    });

    it("New chat with nothing generating starts the new chat without cancelling", async () => {
      const user = userEvent.setup();
      const cancel = vi.fn();
      const startNewConversation = vi.fn();
      render(<Harness reset={reset} cancel={cancel} startNewConversation={startNewConversation} />);

      await user.click(screen.getByRole("button", { name: "Message History" }));
      await user.click(await screen.findByRole("button", { name: "New chat" }));

      expect(startNewConversation).toHaveBeenCalledTimes(1);
      expect(cancel).not.toHaveBeenCalled();
    });
  });
});

describe("regression: the Message History icon is a true toggle", () => {
  const notes = { id: "f1", name: "notes.txt", type: "text/plain", kind: "text", size: 4, base64: "" };

  /**
   * Like useCompletion: the answer panel shows unless the Message History icon
   * tucked it away (setIsAnswerPanelHidden), and nothing here can clear the
   * draft, answer or attachments except reset().
   */
  const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

  const ToggleHarness = ({
    reset,
    handleKeyPress = vi.fn(),
    controls,
  }: {
    reset: () => void;
    /** The main bar's Enter handler (submit). */
    handleKeyPress?: (e: unknown) => void;
    /** Lets a test show the answer panel the way submit() does. */
    controls?: { showAnswerPanel?: () => void };
  }) => {
    const [input, setInput] = useState("draft to keep");
    const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);
    const [isAnswerPanelHidden, setIsAnswerPanelHidden] = useState(false);
    const [attachedFiles] = useState([notes]);
    if (controls) controls.showAnswerPanel = () => setIsAnswerPanelHidden(false);
    return (
      <MemoryRouter>
        <Location />
        <output data-testid="attachments">{attachedFiles.map((f) => f.name).join(",")}</output>
        <Input
          {...({
            // As useCompletion: hidden by the icon, and never shown with the drawer
            isPopoverOpen: !isAnswerPanelHidden && !messageHistoryOpen,
            setIsAnswerPanelHidden,
            isLoading: false,
            reset,
            input,
            setInput,
            handleKeyPress,
            handlePaste: vi.fn(),
            currentConversationId: "conv_current",
            conversationHistory: [
              ...currentConversation,
              { id: "m3", role: "user", content: "Later question", timestamp: 1_700_000_100_000 },
              { id: "m4", role: "assistant", content: "Later answer", timestamp: 1_700_000_100_001 },
            ],
            pendingMessage: null,
            startNewConversation: vi.fn(),
            messageHistoryOpen,
            setMessageHistoryOpen,
            error: null,
            response: "The capital of France is Paris.",
            attachedFiles,
            cancel: vi.fn(),
            scrollAreaRef: createRef(),
            inputRef: createRef(),
            isHidden: false,
            keepEngaged: false,
            setKeepEngaged: vi.fn(),
          } as any)}
        />
      </MemoryRouter>
    );
  };

  let reset: Mock<() => void>;
  beforeEach(() => {
    reset = vi.fn<() => void>();
  });

  const icon = () => screen.getByRole("button", { name: "Message History" });
  const drawer = () => screen.queryByRole("dialog", { name: "Current conversation" });
  const answerPanel = () => screen.queryByText("The capital of France is Paris.");
  const viewport = () => drawer()!.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]")!;
  const scrollDrawerTo = (top: number) => {
    viewport().scrollTop = top;
    fireEvent.scroll(viewport());
  };
  /** Nothing the user had was cleared or reset. */
  const expectStateIntact = () => {
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep");
    expect(screen.getByTestId("attachments")).toHaveTextContent("notes.txt");
    expect(reset).not.toHaveBeenCalled();
  };

  it("click → drawer visible; same icon → hidden (with the answer panel); same icon → visible", async () => {
    const user = userEvent.setup();
    render(<ToggleHarness reset={reset} />);
    expect(answerPanel()).toBeInTheDocument();

    await user.click(icon());
    expect(await screen.findByRole("dialog", { name: "Current conversation" })).toBeVisible();
    expect(icon()).toHaveAttribute("aria-expanded", "true");

    await user.click(icon());
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(icon()).toHaveAttribute("aria-expanded", "false");
    // Only the bar is left: the answer panel is tucked away, not cleared
    expect(answerPanel()).not.toBeInTheDocument();
    expect(icon()).toHaveFocus();
    expectStateIntact();

    await user.click(icon());
    expect(await screen.findByRole("dialog", { name: "Current conversation" })).toBeVisible();
    expect(within(drawer()!).getAllByRole("listitem").filter((li) => li.dataset.role)[0]).toHaveTextContent(
      "Later question"
    );
    expectStateIntact();
  });

  it("scroll the drawer → close with the icon → reopen: exact position restored", async () => {
    const user = userEvent.setup();
    render(<ToggleHarness reset={reset} />);

    await user.click(icon());
    await screen.findByRole("dialog", { name: "Current conversation" });
    expect(viewport().scrollTop).toBe(0);
    scrollDrawerTo(375);

    await user.click(icon());
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    await user.click(icon());
    await screen.findByRole("dialog", { name: "Current conversation" });

    expect(viewport().scrollTop).toBe(375);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(viewport().scrollTop).toBe(375);
    expectStateIntact();
  });

  it.each([
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    [
      "the Close button",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(within(drawer()!).getByRole("button", { name: "Close Message History" })),
    ],
  ])("%s closes the drawer, keeps the answer panel, and the icon reopens it in place", async (_how, closeWith) => {
    const user = userEvent.setup();
    render(<ToggleHarness reset={reset} />);
    await user.click(icon());
    await screen.findByRole("dialog", { name: "Current conversation" });
    scrollDrawerTo(210);

    await closeWith(user);

    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    await waitFor(() => expect(icon()).toHaveFocus());
    expect(answerPanel()).toBeInTheDocument();
    await user.click(icon());
    await screen.findByRole("dialog", { name: "Current conversation" });
    expect(viewport().scrollTop).toBe(210);
    expectStateIntact();
  });

  it("after the icon tucked it away, closing another way shows the answer panel again", async () => {
    const user = userEvent.setup();
    render(<ToggleHarness reset={reset} />);
    await user.click(icon());
    await user.click(icon()); // closes everything below the bar
    await waitFor(() => expect(answerPanel()).not.toBeInTheDocument());

    await user.click(icon());
    await screen.findByRole("dialog", { name: "Current conversation" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(answerPanel()).toBeInTheDocument();
    expectStateIntact();
  });

  it("one drawer: the search bar keeps the SAME drawer; the icon closes and reopens it in place", async () => {
    const user = userEvent.setup();
    render(<ToggleHarness reset={reset} />);
    const historyRoot = icon().parentElement!; // the one MessageHistory component
    const onlyOneDrawer = () => {
      expect(screen.getAllByRole("button", { name: "Message History" })).toHaveLength(1);
      expect(document.querySelectorAll('[data-message-history="current"]')).toHaveLength(1);
    };

    // 1. Open Message History
    await user.click(icon());
    const opened = await screen.findByRole("dialog", { name: "Current conversation" });
    onlyOneDrawer();
    scrollDrawerTo(260);

    // 2–3. Click / focus the search bar: the exact same drawer stays
    await user.click(screen.getByLabelText("Message input"));
    await new Promise((r) => setTimeout(r, 50));
    expect(drawer()).toBe(opened);
    expect(icon()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Message input")).toHaveFocus();
    onlyOneDrawer();

    // 4–5. Type in the search bar: still the same drawer, at the same spot
    await user.type(screen.getByLabelText("Message input"), " and more");
    expect(screen.getByLabelText("Message input")).toHaveValue("draft to keep and more");
    expect(drawer()).toBe(opened);
    expect(viewport().scrollTop).toBe(260);
    onlyOneDrawer();

    // 6–7. The icon closes it
    await user.click(icon());
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(document.querySelectorAll('[data-message-history="current"]')).toHaveLength(0);

    // 8–9. The icon reopens the same component's drawer, at the saved position
    await user.click(icon());
    await screen.findByRole("dialog", { name: "Current conversation" });
    expect(icon().parentElement).toBe(historyRoot);
    expect(viewport().scrollTop).toBe(260);
    onlyOneDrawer();
    expect(screen.getByTestId("attachments")).toHaveTextContent("notes.txt");
    expect(reset).not.toHaveBeenCalled();
  });

  it("typing and Enter in the main bar keep the SAME drawer: no search UI, no navigation, no second surface", async () => {
    const user = userEvent.setup();
    const submitKey = vi.fn();
    render(<ToggleHarness handleKeyPress={submitKey} reset={reset} />);
    await user.click(icon());
    const opened = await screen.findByRole("dialog", { name: "Current conversation" });
    expect(within(opened).queryByRole("textbox")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Message input"), " more");
    await user.keyboard("{Enter}");
    await new Promise((r) => setTimeout(r, 50));

    // Enter is the main bar's own send; the drawer stays the one surface
    expect(submitKey).toHaveBeenCalled();
    expect(drawer()).toBe(opened);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    expect(document.querySelectorAll('[data-message-history="current"]')).toHaveLength(1);
    expect(document.querySelectorAll("[data-radix-popper-content-wrapper]")).toHaveLength(1);
  });

  it("a send while the drawer is open keeps the SAME drawer as the only surface", async () => {
    const user = userEvent.setup();
    const controls: { showAnswerPanel?: () => void } = {};
    render(<ToggleHarness controls={controls} reset={reset} />);
    await user.click(icon());
    await user.click(icon()); // icon close: answer panel tucked away
    await waitFor(() => expect(answerPanel()).not.toBeInTheDocument());
    await user.click(icon());
    const opened = await screen.findByRole("dialog", { name: "Current conversation" });

    // What submit() does: un-hide the answer panel. With the drawer open it stays unmounted.
    act(() => controls.showAnswerPanel!());
    await new Promise((r) => setTimeout(r, 50));

    expect(drawer()).toBe(opened);
    expect(answerPanel()).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-radix-popper-content-wrapper]")).toHaveLength(1);
    expectStateIntact();

    // Closing the drawer (not with the icon) brings the answer panel back
    await user.keyboard("{Escape}");
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(answerPanel()).toBeInTheDocument();
  });

  it("while the drawer is open it is the ONLY surface: the answer panel is not mounted", async () => {
    const user = userEvent.setup();
    render(<ToggleHarness reset={reset} />);
    expect(answerPanel()).toBeInTheDocument();

    await user.click(icon());
    await screen.findByRole("dialog", { name: "Current conversation" });

    expect(answerPanel()).not.toBeInTheDocument();
    const surfaces = document.querySelectorAll("[data-radix-popper-content-wrapper]");
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].querySelector('[data-message-history="current"]')).not.toBeNull();
    // No overlay tricks: nothing relies on stacking order
    expect(drawer()).not.toHaveClass("z-50");
  });
});
