import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/types/completion";
import { MessageHistory } from "./MessageHistory";

const mocks = vi.hoisted(() => ({
  getAllConversations: vi.fn(),
  deleteConversation: vi.fn(),
  useHistory: vi.fn(),
  autoScroll: true,
  /** The drawer's scroll viewport, with geometry the tests control. */
  viewport: {
    el: null as HTMLDivElement | null,
    scrollHeight: 1000,
    clientHeight: 400,
    scrollTop: 0, // at the top, where the newest exchange is
    scrollTo: null as any,
    scrollBy: null as any,
  },
}));

// The drawer must never browse or change the conversation database: these
// spies prove it.
vi.mock("@/lib", () => ({
  getAllConversations: mocks.getAllConversations,
  deleteConversation: mocks.deleteConversation,
  deleteAllConversations: vi.fn(),
  DOWNLOAD_SUCCESS_DISPLAY_MS: 1000,
}));
vi.mock("@/hooks/useHistory", () => ({ useHistory: mocks.useHistory }));
vi.mock("@/lib/storage/response-settings.storage", () => ({
  getResponseSettings: () => ({ autoScroll: mocks.autoScroll }),
}));
vi.mock("@/components", async () => {
  const popover = await vi.importActual<typeof import("@/components/ui/popover")>(
    "@/components/ui/popover"
  );
  const setupViewport = (el: HTMLDivElement | null) => {
    const viewport = mocks.viewport;
    if (!el || viewport.el === el) return;
    viewport.el = el;
    Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => viewport.scrollHeight });
    Object.defineProperty(el, "clientHeight", { configurable: true, get: () => viewport.clientHeight });
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => viewport.scrollTop,
      set: (v: number) => (viewport.scrollTop = v),
    });
    el.scrollTo = viewport.scrollTo;
    el.scrollBy = viewport.scrollBy;
  };
  return {
    ...popover,
    Button: ({ children, variant: _v, size: _s, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    // Mirrors Radix's structure: the ref goes on the root, scrolling happens
    // in the viewport inside it.
    ScrollArea: ({ children, className, ref }: any) => (
      <div className={className} ref={ref}>
        <div data-radix-scroll-area-viewport="" ref={setupViewport}>
          {children}
        </div>
      </div>
    ),
    Markdown: ({ children }: any) => <span>{children}</span>,
  };
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

const message = (
  id: string,
  role: "user" | "assistant",
  content: string,
  timestamp: number,
  extra: Partial<ChatMessage> = {}
): ChatMessage => ({ id, role, content, timestamp, ...extra });

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date(2026, 9, 1, 9, 0).getTime();

// Deliberately stored out of order: the drawer pairs by time, newest first.
const current: ChatMessage[] = [
  message("a3", "user", "What is its complexity?", t0 + DAY),
  message("a1", "user", "What is binary search?", t0),
  message("a4", "assistant", "O(log n).", t0 + DAY + 1),
  message("a2", "assistant", "Binary search is an algorithm…", t0 + 1),
];
const newQuestion = message("pending_1", "user", "Show me an example", t0 + DAY + 5);

// The 4-exchange conversation reported from the running app, as stored
// (oldest → newest, real timestamps; answers shortened).
const reported = {
  q1: "hi",
  a1: "Hi there! How can I help you today?",
  q2: "hi hey can you give me leetcode 100 th ans",
  a2: "Hello! It looks like you're referring to LeetCode problem #100.",
  q3: "hi can you tell what time is now",
  a3: "Hello! I don't have access to real-time clocks.",
  q4: "hi",
  a4: "Hi there! How can I help you today?",
};
const reportedMessages: ChatMessage[] = [
  { id: "m1", role: "user", content: reported.q1, timestamp: 1790949451684 },
  { id: "m2", role: "assistant", content: reported.a1, timestamp: 1790949451685 },
  { id: "m3", role: "user", content: reported.q2, timestamp: 1790951152718 },
  { id: "m4", role: "assistant", content: reported.a2, timestamp: 1790951152719 },
  { id: "m5", role: "user", content: reported.q3, timestamp: 1790951963307 },
  { id: "m6", role: "assistant", content: reported.a3, timestamp: 1790951963308 },
  { id: "m7", role: "user", content: reported.q4, timestamp: 1790959600725 },
  { id: "m8", role: "assistant", content: reported.a4, timestamp: 1790959600726 },
];
/** Newest exchange first, each answer directly under its question. */
const reportedNewestFirst = [
  reported.q4,
  reported.a4,
  reported.q3,
  reported.a3,
  reported.q2,
  reported.a2,
  reported.q1,
  reported.a1,
];

type User = ReturnType<typeof userEvent.setup>;

type HarnessProps = {
  conversationId?: string | null;
  history?: ChatMessage[];
  pendingMessage?: ChatMessage | null;
  response?: string;
  isLoading?: boolean;
  onStartNewConversation?: () => void;
};

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

/**
 * Mirrors how Input wires the drawer to useCompletion's state. Props stand in
 * for that state (rerender to send, stream or save); New chat clears it.
 */
const Harness = ({
  conversationId = "conv_a",
  history = current,
  pendingMessage = null,
  response = "",
  isLoading = false,
  onStartNewConversation,
}: HarnessProps) => {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  // Passing a new history array stands in for loading a conversation again
  // (e.g. Continue chat) after New chat cleared it.
  useEffect(() => setCleared(false), [history]);
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Location />
      <Routes>
        <Route
          path="/"
          element={
            <MessageHistory
              conversationHistory={cleared ? [] : history}
              currentConversationId={cleared ? null : conversationId}
              pendingMessage={cleared ? null : pendingMessage}
              response={cleared ? "" : response}
              isLoading={cleared ? false : isLoading}
              onStartNewConversation={() => {
                onStartNewConversation?.();
                setCleared(true);
              }}
              messageHistoryOpen={open}
              setMessageHistoryOpen={setOpen}
            />
          }
        />
        <Route path="/toggle/settings/history" element={<h1>All conversations</h1>} />
      </Routes>
    </MemoryRouter>
  );
};

const trigger = () => screen.getByRole("button", { name: "Message History" });
const drawer = () => screen.queryByRole("dialog", { name: "Current conversation" });
const openDrawer = async (user: User) => {
  await user.click(trigger());
  return screen.findByRole("dialog", { name: "Current conversation" });
};
/** Message items in display order (day dividers left out). */
const entries = (root: HTMLElement = drawer()!) =>
  within(root)
    .getAllByRole("listitem")
    .filter((li) => li.hasAttribute("data-role"));
const thread = (root?: HTMLElement) =>
  entries(root).map((li) => [li.dataset.role, li.textContent!.replace(/\d{1,2}:\d{2}\s*[AP]M/i, "")]);

const nextFrame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const userScrollsTo = (top: number) => {
  mocks.viewport.scrollTop = top;
  act(() => {
    mocks.viewport.el!.dispatchEvent(new Event("scroll"));
  });
};
const scrollTargets = () => mocks.viewport.scrollTo.mock.calls.map(([options]: any[]) => options.top);

describe("Main bar → Message History (current conversation)", () => {
  beforeEach(() => {
    mocks.getAllConversations.mockReset();
    mocks.deleteConversation.mockReset();
    mocks.useHistory.mockReset();
    mocks.autoScroll = true;
    Object.assign(mocks.viewport, {
      el: null,
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 0,
      scrollTo: vi.fn(),
      scrollBy: vi.fn(),
    });
  });

  describe("regression: the reported 4-exchange conversation", () => {
    /** Rendered DOM order: each message item's text (after its label row), top to bottom. */
    const renderedTexts = (view: HTMLElement) =>
      [...view.querySelectorAll<HTMLElement>("li[data-role]")].map((li) => li.children[1]?.textContent ?? "");

    it("renders the newest question first in the DOM, its answer directly under it", async () => {
      const user = userEvent.setup();
      const stored = Object.freeze(reportedMessages.map((m) => Object.freeze({ ...m })));
      render(<Harness conversationId="conv_reported" history={stored as unknown as ChatMessage[]} />);

      const view = await openDrawer(user);

      expect(renderedTexts(view)).toEqual(reportedNewestFirst);
      // DOM position, not just array order: the newest question precedes the oldest
      const questions = [...view.querySelectorAll('li[data-role="user"]')];
      expect(questions.map((li) => li.textContent)).toEqual([
        expect.stringMatching(/10:16\s*PM/i),
        expect.stringContaining(reported.q3),
        expect.stringContaining(reported.q2),
        expect.stringMatching(/0?7:27\s*PM/i),
      ]);
      expect(questions[0].compareDocumentPosition(questions[3]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Nothing re-reverses it visually
      expect(view.querySelector('[class*="reverse"]')).toBeNull();
      // The stored conversation is untouched
      expect(stored.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
    });

    it("a fifth question goes on top while it streams, then stays on top once saved", async () => {
      const user = userEvent.setup();
      const q5 = message("pending_5", "user", "and the date?", 1790960000000);
      const { rerender } = render(<Harness conversationId="conv_reported" history={reportedMessages} />);
      const view = await openDrawer(user);

      rerender(
        <Harness conversationId="conv_reported" history={reportedMessages} isLoading pendingMessage={q5} response="It is" />
      );
      expect(renderedTexts(view).slice(0, 3)).toEqual(["and the date?", "It is", reported.q4]);

      rerender(
        <Harness
          conversationId="conv_reported"
          history={[
            ...reportedMessages,
            message("m9", "user", "and the date?", 1790960000100),
            message("m10", "assistant", "It is Friday.", 1790960000101),
          ]}
        />
      );
      expect(renderedTexts(view)).toEqual(["and the date?", "It is Friday.", ...reportedNewestFirst]);
    });
  });

  describe("compact layout", () => {
    it("is only a compact header (title, small New chat, Close) and the Conversation Mode thread", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);
      const [header, messages, ...rest] = Array.from(view.children) as HTMLElement[];

      expect(rest).toHaveLength(0);
      expect(header.tagName).toBe("HEADER");
      expect(header).toHaveClass("h-9");
      // The conversation's title: its first question
      expect(header.querySelector("p")).toHaveTextContent("What is binary search?");
      expect(within(header).getAllByRole("button").map((b) => b.textContent || b.getAttribute("aria-label"))).toEqual([
        "New chat",
        "Close Message History",
      ]);
      expect(within(header).getByRole("button", { name: "New chat" })).toHaveClass("h-7", "text-xs");
      expect(messages).toBe(within(view).getByRole("region", { name: "Messages" }));
      // Conversation Mode messages, nothing else
      expect(within(messages).getAllByRole("list")).toEqual([within(messages).getByRole("list", { name: "Conversation" })]);
      expect(entries(view)[0]).toHaveClass("p-3", "rounded-lg", "border-l-4", "border-primary");
    });

    it("has no View all, no search, no date headers, no other modes or headings", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);

      expect(within(view).queryByRole("button", { name: /View all conversations/ })).not.toBeInTheDocument();
      expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
      expect(within(view).queryByRole("searchbox")).not.toBeInTheDocument();
      expect(within(view).queryByText(/^(Today|Yesterday)$/)).not.toBeInTheDocument();
      expect(view.querySelector("[data-day-divider]")).toBeNull();
      expect(within(view).queryByRole("switch")).not.toBeInTheDocument();
      expect(within(view).queryByRole("tab")).not.toBeInTheDocument();
      expect(within(view).queryByRole("heading")).not.toBeInTheDocument();
      expect(view.querySelector("footer")).toBeNull();
    });

    it("gives the thread the height the header and footer used to take", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);

      expect(view.querySelector("footer")).toBeNull();
      expect(mocks.viewport.el!.parentElement).toHaveClass("h-[calc(100vh-8rem)]");
    });
  });

  describe("current conversation", () => {
    it("shows the newest question first, its answer directly below, older exchanges after", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);

      expect(thread(view)).toEqual([
        ["user", "YouWhat is its complexity?"],
        ["assistant", "AIO(log n)."],
        ["user", "YouWhat is binary search?"],
        ["assistant", "AIBinary search is an algorithm…"],
      ]);
    });

    it("lists three exchanges newest → oldest", async () => {
      const user = userEvent.setup();
      render(
        <Harness
          history={[
            message("q1", "user", "Older question", t0),
            message("r1", "assistant", "Older answer", t0 + 1),
            message("q2", "user", "Previous question", t0 + 100),
            message("r2", "assistant", "Previous answer", t0 + 101),
            message("q3", "user", "Latest question", t0 + 200),
            message("r3", "assistant", "Latest answer", t0 + 201),
          ]}
        />
      );

      const view = await openDrawer(user);

      expect(thread(view).map(([, text]) => text)).toEqual([
        "YouLatest question",
        "AILatest answer",
        "YouPrevious question",
        "AIPrevious answer",
        "YouOlder question",
        "AIOlder answer",
      ]);
    });

    it("never mutates or reorders the stored conversation", async () => {
      const user = userEvent.setup();
      const stored = Object.freeze(current.map((m) => Object.freeze({ ...m })));
      const before = JSON.stringify(stored);
      const { rerender } = render(<Harness history={stored as unknown as ChatMessage[]} />);

      await openDrawer(user);
      rerender(
        <Harness history={stored as unknown as ChatMessage[]} isLoading pendingMessage={newQuestion} response="Here" />
      );

      expect(JSON.stringify(stored)).toBe(before);
      expect(stored.map((m) => m.id)).toEqual(["a3", "a1", "a4", "a2"]);
    });

    it("never renders the full conversation list or reads the database", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);

      expect(within(view).queryByRole("list", { name: /conversations/i })).not.toBeInTheDocument();
      expect(within(view).queryByText("Recent Conversations")).not.toBeInTheDocument();
      expect(within(view).queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
      expect(within(view).queryByRole("button", { name: "Continue chat" })).not.toBeInTheDocument();
      expect(mocks.getAllConversations).not.toHaveBeenCalled();
      expect(mocks.useHistory).not.toHaveBeenCalled();
    });

    it("keeps a subtle, compact timestamp on each message", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);
      const time = entries(view)[2].querySelector("span.tabular-nums")!;

      expect(time).toHaveTextContent(/0?9:00\s*AM/i);
      expect(time).toHaveClass("text-[11px]", "text-muted-foreground/60");
    });

    it("labels files attached to a question", async () => {
      const user = userEvent.setup();
      const attached = (name: string, type: string, kind: "image" | "text") => ({
        id: name,
        name,
        type,
        kind,
        size: 10,
        base64: "",
      });
      render(
        <Harness
          history={[
            message("f1", "user", "Review these", t0, {
              attachedFiles: [
                attached("screenshot_1.png", "image/png", "image"),
                attached("notes.txt", "text/plain", "text"),
              ],
            }),
            message("f2", "assistant", "Looks good.", t0 + 1),
            message("f3", "user", "Anything else?", t0 + 2),
            message("f4", "assistant", "No.", t0 + 3),
          ]}
        />
      );

      const view = await openDrawer(user);
      // The newer exchange is on top; the files stay on their own question
      const [newer, newerAnswer, question, answer] = entries(view);
      expect(newer).toHaveTextContent("Anything else?");
      expect(question).toHaveTextContent("Review these");
      for (const item of [newer, newerAnswer, answer]) {
        expect(within(item).queryByTestId("message-attachments")).not.toBeInTheDocument();
      }
      expect(within(question).getByTestId("message-attachments")).toHaveTextContent(
        "Attached: screenshot_1.png, notes.txt"
      );
    });

    it("badges the trigger with the current conversation's message count", () => {
      render(<Harness />);

      expect(trigger().parentElement).toHaveTextContent("4");
    });

    it("keeps long text wrapped inside the drawer", async () => {
      const user = userEvent.setup();
      render(
        <Harness
          history={[
            message("l1", "user", "X".repeat(5000), t0),
            message("l2", "assistant", `https://example.com/${"x".repeat(4000)}`, t0 + 1),
          ]}
        />
      );

      const view = await openDrawer(user);

      expect(within(view).getByRole("list", { name: "Conversation" })).toHaveClass(
        "break-words",
        "[overflow-wrap:anywhere]"
      );
    });
  });

  describe("new question and live answer", () => {
    it("puts a newly submitted question at the top, above every older exchange", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness />);
      await openDrawer(user);

      rerender(<Harness isLoading pendingMessage={newQuestion} />);

      expect(thread()).toEqual([
        ["user", "YouShow me an example"],
        ["assistant", "Generating response..."],
        ["user", "YouWhat is its complexity?"],
        ["assistant", "AIO(log n)."],
        ["user", "YouWhat is binary search?"],
        ["assistant", "AIBinary search is an algorithm…"],
      ]);
    });

    it("keeps the new question on top even with an earlier clock", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness />);
      await openDrawer(user);

      rerender(<Harness isLoading pendingMessage={{ ...newQuestion, timestamp: t0 - DAY }} />);

      const roles = thread().map(([role, text]) => `${role}:${text}`);
      expect(roles.slice(0, 2)).toEqual(["user:YouShow me an example", "assistant:Generating response..."]);
      expect(roles[roles.length - 2]).toBe("user:YouWhat is binary search?");
    });

    it("streams the answer directly under its question, which stays visible", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness isLoading pendingMessage={newQuestion} />);
      await openDrawer(user);

      for (const response of ["Here", "Here is one:", "Here is one: [1, 3, 5]"]) {
        rerender(<Harness isLoading pendingMessage={newQuestion} response={response} />);
        const items = entries();
        expect(items).toHaveLength(6);
        expect(items[0]).toHaveTextContent("Show me an example");
        expect(items[1]).toHaveTextContent(response);
        expect(items[1]).toHaveAttribute("data-streaming", "true");
        expect(items[1]).toHaveAttribute("aria-busy", "true");
        expect(items[2]).toHaveTextContent("What is its complexity?");
      }
    });

    it("shows the saved exchange once, in place, when the answer is done", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Harness isLoading pendingMessage={newQuestion} response="Here is one: [1, 3, 5]" />
      );
      await openDrawer(user);

      // useCompletion saves the exchange and clears the pending question at once
      rerender(
        <Harness
          history={[
            ...current,
            message("u5", "user", "Show me an example", t0 + DAY + 9),
            message("a5", "assistant", "Here is one: [1, 3, 5]", t0 + DAY + 10),
          ]}
          response="Here is one: [1, 3, 5]"
        />
      );

      expect(thread().slice(0, 3)).toEqual([
        ["user", "YouShow me an example"],
        ["assistant", "AIHere is one: [1, 3, 5]"],
        ["user", "YouWhat is its complexity?"],
      ]);
      expect(entries()).toHaveLength(6);
      expect(drawer()!.querySelector("[data-streaming]")).toBeNull();
      expect(trigger().parentElement).toHaveTextContent("6");
    });

    it("shows a new chat's first question before anything is saved", async () => {
      const user = userEvent.setup();
      render(<Harness conversationId={null} history={[]} isLoading pendingMessage={newQuestion} />);

      const view = await openDrawer(user);

      expect(within(view).queryByText("No conversation yet")).not.toBeInTheDocument();
      expect(thread(view)).toEqual([
        ["user", "YouShow me an example"],
        ["assistant", "Generating response..."],
      ]);
    });
  });

  describe("auto-scroll", () => {
    it("opening starts at the top, where the newest exchange is, without scrolling", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openDrawer(user);
      await nextFrame();

      expect(mocks.viewport.scrollTop).toBe(0);
      expect(scrollTargets().every((top: number) => top === 0)).toBe(true);
    });

    it("sending a question scrolls back to the top to show it, even from older messages", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(600);
      mocks.viewport.scrollTo.mockClear();

      rerender(<Harness isLoading pendingMessage={newQuestion} />);
      await nextFrame();

      expect(mocks.viewport.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });

    it("keeps the streaming answer in view while the reader is at the top", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness isLoading pendingMessage={newQuestion} />);
      await openDrawer(user);
      await nextFrame();
      mocks.viewport.scrollTo.mockClear();

      rerender(<Harness isLoading pendingMessage={newQuestion} response="Here is one" />);
      await nextFrame();

      expect(mocks.viewport.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    });

    it("leaves a reader of older messages alone until the next question is sent", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness isLoading pendingMessage={newQuestion} />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(600);
      mocks.viewport.scrollTo.mockClear();

      rerender(<Harness isLoading pendingMessage={newQuestion} response="Here is one" />);
      rerender(<Harness isLoading pendingMessage={newQuestion} response="Here is one: [1, 3, 5]" />);
      rerender(<Harness pendingMessage={newQuestion} response="Here is one: [1, 3, 5]" />);
      await nextFrame();
      expect(mocks.viewport.scrollTo).not.toHaveBeenCalled();

      const next = message("pending_2", "user", "Another?", t0 + DAY + 20);
      rerender(<Harness isLoading pendingMessage={next} />);
      await nextFrame();
      expect(mocks.viewport.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
      // Never towards the oldest messages at the bottom
      expect(scrollTargets().every((top: number) => top === 0)).toBe(true);
    });

    it("respects Auto-scroll being off for streamed text", async () => {
      mocks.autoScroll = false;
      const user = userEvent.setup();
      const { rerender } = render(<Harness isLoading pendingMessage={newQuestion} />);
      await openDrawer(user);
      await nextFrame();
      mocks.viewport.scrollTo.mockClear();

      rerender(<Harness isLoading pendingMessage={newQuestion} response="Here is one" />);
      await nextFrame();

      expect(mocks.viewport.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe("icon toggle and reading position", () => {
    /** A freshly mounted scroll area starts at the top, like a real one. */
    const freshViewport = () => {
      mocks.viewport.scrollTop = 0;
    };
    const reopen = async (user: User) => {
      freshViewport();
      mocks.viewport.scrollTo.mockClear();
      return openDrawer(user);
    };

    it("the icon opens the drawer and the same icon closes it, returning focus to it", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(trigger());
      expect(await screen.findByRole("dialog", { name: "Current conversation" })).toBeInTheDocument();
      expect(trigger()).toHaveAttribute("aria-expanded", "true");

      await user.click(trigger());

      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(trigger()).toHaveFocus();
      // Closing never touches the conversation
      expect(trigger().parentElement).toHaveTextContent("4");
    });

    it("reopening with the icon returns to the exact position, with no jump", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(450); // the middle of the thread

      await user.click(trigger());
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      await reopen(user);

      // Restored as the drawer mounts, before any frame is drawn...
      expect(mocks.viewport.scrollTop).toBe(450);
      await nextFrame();
      // ...and nothing scrolls it away afterwards
      expect(mocks.viewport.scrollTop).toBe(450);
      expect(mocks.viewport.scrollTo).not.toHaveBeenCalled();
    });

    it.each([
      ["Close", async (user: User) => user.click(screen.getByRole("button", { name: "Close Message History" }))],
      ["Escape", async (user: User) => user.keyboard("{Escape}")],
    ])("closing with %s keeps the position and returns focus to the icon", async (_how, closeWith) => {
      const user = userEvent.setup();
      render(<Harness />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(320);

      await closeWith(user);
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      await waitFor(() => expect(trigger()).toHaveFocus());
      await reopen(user);

      expect(mocks.viewport.scrollTop).toBe(320);
    });

    it("the first open of a conversation starts at the newest exchange", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await reopen(user);
      await nextFrame();

      expect(mocks.viewport.scrollTop).toBe(0);
    });

    it("another conversation starts at its newest exchange, and each keeps its own position", async () => {
      const user = userEvent.setup();
      const other = [message("o1", "user", "Other question", t0), message("o2", "assistant", "Other answer", t0 + 1)];
      const { rerender } = render(<Harness conversationId="conv_a" history={current} />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(450);
      await user.click(trigger());
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());

      rerender(<Harness conversationId="conv_b" history={other} />);
      await reopen(user);
      expect(mocks.viewport.scrollTop).toBe(0);
      expect(entries()[0]).toHaveTextContent("Other question");
      await nextFrame();
      userScrollsTo(120);
      await user.click(trigger());
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());

      rerender(<Harness conversationId="conv_a" history={current} />);
      await reopen(user);
      expect(mocks.viewport.scrollTop).toBe(450);
    });

    it("back in a conversation, its restored spot is not pulled to the top by later updates", async () => {
      const user = userEvent.setup();
      const other = [message("o1", "user", "Other question", t0), message("o2", "assistant", "Other answer", t0 + 1)];
      const { rerender } = render(<Harness conversationId="conv_a" history={current} />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(450);
      await user.click(trigger());
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      // Away to another conversation and back (switching starts each at its newest)
      rerender(<Harness conversationId="conv_b" history={other} />);
      rerender(<Harness conversationId="conv_a" history={current} />);
      await reopen(user);
      await nextFrame();
      expect(mocks.viewport.scrollTop).toBe(450);

      // A later update (e.g. the answer panel's text changing) must not pull the reader up
      rerender(<Harness conversationId="conv_a" history={current} response="Updated answer" />);
      await nextFrame();

      expect(mocks.viewport.scrollTo).not.toHaveBeenCalled();
      expect(mocks.viewport.scrollTop).toBe(450);
    });

    it("New chat forgets the position: the conversation loaded again starts at the newest", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness />);
      const view = await openDrawer(user);
      await nextFrame();
      userScrollsTo(450);

      await user.click(within(view).getByRole("button", { name: "New chat" }));
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      rerender(<Harness history={[...current]} />); // e.g. Continue chat on the same conversation
      await reopen(user);

      expect(entries()).toHaveLength(4);
      expect(mocks.viewport.scrollTop).toBe(0);
    });

    it("a question sent since closing opens at the newest exchange, not the old spot", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(450);
      await user.click(trigger());
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());

      rerender(<Harness isLoading pendingMessage={newQuestion} />);
      rerender(
        <Harness
          history={[
            ...current,
            message("u5", "user", "Show me an example", t0 + DAY + 9),
            message("a5", "assistant", "Here is one.", t0 + DAY + 10),
          ]}
        />
      );
      await reopen(user);

      expect(mocks.viewport.scrollTop).toBe(0);
      expect(entries()[0]).toHaveTextContent("Show me an example");
    });

    it("sending while reading a restored older spot still brings the new question into view", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(450);
      await user.click(trigger());
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      await reopen(user);
      await nextFrame();
      expect(mocks.viewport.scrollTop).toBe(450);

      rerender(<Harness isLoading pendingMessage={newQuestion} />);
      await nextFrame();

      expect(mocks.viewport.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });

    it("a restored older spot is left alone while an answer streams", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Harness isLoading pendingMessage={newQuestion} />);
      await openDrawer(user);
      await nextFrame();
      userScrollsTo(450);
      await user.click(trigger());
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      await reopen(user);
      await nextFrame();

      rerender(<Harness isLoading pendingMessage={newQuestion} response="Here is one" />);
      await nextFrame();

      expect(mocks.viewport.scrollTo).not.toHaveBeenCalled();
      expect(mocks.viewport.scrollTop).toBe(450);
    });
  });

  describe("empty state", () => {
    it("shows 'No conversation yet' when nothing is active", async () => {
      const user = userEvent.setup();
      render(<Harness conversationId={null} history={[]} />);

      const view = await openDrawer(user);

      expect(within(view).getByText("No conversation yet")).toBeInTheDocument();
      expect(within(view).getByText(/this conversation will show up here/)).toBeInTheDocument();
      expect(within(view).queryByRole("list", { name: "Conversation" })).not.toBeInTheDocument();
      expect(within(view).queryByRole("button", { name: /New chat/ })).not.toBeInTheDocument();
      expect(within(view).getByText("New conversation")).toBeInTheDocument();
      expect(trigger().parentElement).not.toHaveTextContent(/\d/);
    });

    it("treats an id without messages as no conversation", async () => {
      const user = userEvent.setup();
      render(<Harness conversationId="conv_a" history={[]} />);

      expect(within(await openDrawer(user)).getByText("No conversation yet")).toBeInTheDocument();
    });
  });

  describe("open / close and New chat", () => {
    it("the current conversation survives closing and reopening", async () => {
      const user = userEvent.setup();
      const onNew = vi.fn();
      render(<Harness onStartNewConversation={onNew} />);

      await openDrawer(user);
      await user.click(screen.getByRole("button", { name: "Close Message History" }));
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());

      const view = await openDrawer(user);
      expect(entries(view)).toHaveLength(4);
      expect(onNew).not.toHaveBeenCalled();
    });

    it("New chat clears the view, leaving no stale messages", async () => {
      const user = userEvent.setup();
      const onNew = vi.fn();
      render(<Harness onStartNewConversation={onNew} />);

      const view = await openDrawer(user);
      await user.click(within(view).getByRole("button", { name: "New chat" }));

      expect(onNew).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      const reopened = await openDrawer(user);
      expect(within(reopened).getByText("No conversation yet")).toBeInTheDocument();
      expect(within(reopened).queryByRole("listitem")).not.toBeInTheDocument();
      expect(trigger().parentElement).not.toHaveTextContent(/\d/);
    });

    it("New chat also clears a question still being answered", async () => {
      const user = userEvent.setup();
      render(<Harness isLoading pendingMessage={newQuestion} response="Here" />);

      const view = await openDrawer(user);
      await user.click(within(view).getByRole("button", { name: "New chat" }));

      const reopened = await openDrawer(user);
      expect(within(reopened).queryByText("Show me an example")).not.toBeInTheDocument();
      expect(within(reopened).getByText("No conversation yet")).toBeInTheDocument();
    });

    it("New chat never touches saved conversations", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);
      await user.click(within(view).getByRole("button", { name: "New chat" }));

      expect(mocks.deleteConversation).not.toHaveBeenCalled();
      expect(mocks.getAllConversations).not.toHaveBeenCalled();
    });
  });

  describe("keyboard and focus", () => {
    it("opening focuses the messages, not a header action", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const view = await openDrawer(user);

      await waitFor(() => expect(within(view).getByRole("region", { name: "Messages" })).toHaveFocus());
    });

    it("Escape closes and returns focus to the Message History button", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openDrawer(user);
      await user.keyboard("{Escape}");

      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      await waitFor(() => expect(trigger()).toHaveFocus());
    });

    it("Close returns focus to the Message History button", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openDrawer(user);
      await user.click(screen.getByRole("button", { name: "Close Message History" }));

      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      await waitFor(() => expect(trigger()).toHaveFocus());
    });

    it("Shift+Tab walks the toolbar right → left, and Enter on the trigger opens it", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      trigger().focus();
      await user.keyboard("{Enter}");
      const view = await screen.findByRole("dialog", { name: "Current conversation" });
      await waitFor(() => expect(within(view).getByRole("region", { name: "Messages" })).toHaveFocus());

      await user.tab({ shift: true });
      expect(within(view).getByRole("button", { name: "Close Message History" })).toHaveFocus();
      await user.tab({ shift: true });
      expect(within(view).getByRole("button", { name: "New chat" })).toHaveFocus();
    });

    it("arrow keys scroll the transcript without reaching the response panel's handler", async () => {
      const user = userEvent.setup();
      const windowKeys = vi.fn();
      window.addEventListener("keydown", windowKeys);
      render(<Harness />);

      await openDrawer(user);
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowUp}");

      expect(mocks.viewport.scrollBy.mock.calls.map(([options]: any[]) => options.top)).toEqual([100, -100]);
      expect(windowKeys).not.toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowDown" }));
      window.removeEventListener("keydown", windowKeys);
    });
  });
});
