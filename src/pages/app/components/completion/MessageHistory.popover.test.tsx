import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ChatConversation, ChatMessage } from "@/types/completion";
import { MessageHistory } from "./MessageHistory";

const db = vi.hoisted(() => ({
  conversations: [] as any[],
  getAllConversations: vi.fn(),
  deleteConversation: vi.fn(),
}));

vi.mock("@/lib", () => ({
  getAllConversations: db.getAllConversations,
  deleteConversation: db.deleteConversation,
  deleteAllConversations: vi.fn(),
  DOWNLOAD_SUCCESS_DISPLAY_MS: 1000,
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
    ScrollArea: ({ children, className }: any) => <div className={className}>{children}</div>,
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

const message = (id: string, role: "user" | "assistant", content: string, timestamp: number): ChatMessage => ({
  id,
  role,
  content,
  timestamp,
});

const chatA: ChatConversation = {
  id: "conv_a",
  title: "Binary search",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  // Deliberately stored out of order: the transcript must sort chronologically.
  messages: [
    message("a3", "user", "What is its complexity?", 1_700_000_000_200),
    message("a1", "user", "What is binary search?", 1_700_000_000_000),
    message("a4", "assistant", "O(log n).", 1_700_000_000_300),
    message("a2", "assistant", "Binary search is an algorithm…", 1_700_000_000_100),
  ],
};
const chatB: ChatConversation = {
  id: "conv_b",
  title: "Primary colors",
  createdAt: 1_700_000_500_000,
  updatedAt: 1_700_000_900_000, // newer than A
  messages: [
    message("b1", "user", "A primary color?", 1_700_000_500_000),
    message("b2", "assistant", "Red", 1_700_000_900_000),
  ],
};

const Harness = ({
  currentConversationId = null,
  conversationHistory = [],
  onOpenChange,
}: {
  currentConversationId?: string | null;
  conversationHistory?: ChatMessage[];
  onOpenChange?: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <MessageHistory
      conversationHistory={conversationHistory}
      currentConversationId={currentConversationId}
      onStartNewConversation={vi.fn()}
      messageHistoryOpen={open}
      setMessageHistoryOpen={(next) => {
        onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
};

type User = ReturnType<typeof userEvent.setup>;

const openHistory = async (user: User) => {
  await user.click(screen.getByRole("button", { name: "View Conversations" }));
  return screen.findByRole("list", { name: "Recent conversations" });
};
const rowButton = (list: HTMLElement, title: string) =>
  within(list).getByRole("button", { name: new RegExp(`^${title}`) });
const openConversation = async (user: User, title: string) => {
  const list = await openHistory(user);
  await user.click(rowButton(list, title));
  return screen.findByRole("list", { name: "Conversation" });
};
const historyIsOpen = () => screen.queryByRole("dialog") !== null;

describe("Main overlay Message History browser", () => {
  let selected: Mock<(event: Event) => void>;

  beforeEach(() => {
    db.conversations = [chatA, chatB];
    db.getAllConversations.mockReset().mockImplementation(async () => [...db.conversations]);
    db.deleteConversation.mockReset().mockImplementation(async (id: string) => {
      db.conversations = db.conversations.filter((c) => c.id !== id);
      return true;
    });
    selected = vi.fn<(event: Event) => void>();
    window.addEventListener("conversationSelected", selected);
  });

  afterEach(() => {
    window.removeEventListener("conversationSelected", selected);
  });

  describe("Recent Conversations", () => {
    it("opens Recent Conversations with fresh data, not the active chat", async () => {
      const user = userEvent.setup();
      render(<Harness currentConversationId="conv_a" conversationHistory={chatA.messages} />);
      expect(db.getAllConversations).not.toHaveBeenCalled();

      const list = await openHistory(user);

      expect(db.getAllConversations).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("heading", { name: "Recent Conversations" })).toBeInTheDocument();
      expect(within(list).getAllByRole("listitem")).toHaveLength(2);
      expect(screen.queryByRole("list", { name: "Conversation" })).not.toBeInTheDocument();
      expect(screen.queryByText("O(log n).")).not.toBeInTheDocument();
    });

    it("lists the latest conversations first with date and message count", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const list = await openHistory(user);
      const titles = within(list)
        .getAllByRole("listitem")
        .map((li) => li.querySelector("[data-conversation-title]")!.textContent);

      expect(titles).toEqual(["Primary colors", "Binary search"]);
      expect(within(rowButton(list, "Binary search")).getByText(/4 messages/)).toBeInTheDocument();
      expect(within(rowButton(list, "Primary colors")).getByText(/2 messages/)).toBeInTheDocument();
    });

    it("clearly marks the current conversation", async () => {
      const user = userEvent.setup();
      render(<Harness currentConversationId="conv_a" conversationHistory={chatA.messages} />);

      const list = await openHistory(user);

      expect(rowButton(list, "Binary search")).toHaveAttribute("aria-current", "true");
      expect(within(rowButton(list, "Binary search")).getByText("Current")).toBeInTheDocument();
      expect(rowButton(list, "Primary colors")).not.toHaveAttribute("aria-current");
    });

    it("shows a loading state without flashing the empty state", async () => {
      let finish!: () => void;
      db.getAllConversations.mockImplementation(
        () => new Promise((resolve) => (finish = () => resolve([...db.conversations])))
      );
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole("button", { name: "View Conversations" }));

      expect(await screen.findByRole("status")).toHaveTextContent("Loading conversations…");
      expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument();
      await act(async () => finish());
      expect(await screen.findByRole("list", { name: "Recent conversations" })).toBeInTheDocument();
    });

    it("shows an empty state when there are no conversations", async () => {
      db.conversations = [];
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole("button", { name: "View Conversations" }));

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      expect(screen.getByText("0 conversations")).toBeInTheDocument();
    });
  });

  describe("Conversation view", () => {
    it("clicking a conversation opens its Q&A in the same workflow", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openConversation(user, "Binary search");

      expect(screen.getByRole("heading", { name: "Binary search" })).toBeInTheDocument();
      expect(screen.getByText("4 messages")).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Recent conversations" })).not.toBeInTheDocument();
      expect(historyIsOpen()).toBe(true);
      // Browsing never loads anything into the main input by itself
      await new Promise((r) => setTimeout(r, 80));
      expect(selected).not.toHaveBeenCalled();
    });

    it("shows questions and answers in chronological order", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const transcript = await openConversation(user, "Binary search");
      const entries = within(transcript)
        .getAllByRole("listitem")
        .map((li) => [li.getAttribute("data-role"), li.textContent]);

      expect(entries.map(([role]) => role)).toEqual(["user", "assistant", "user", "assistant"]);
      expect(entries[0][1]).toContain("You");
      expect(entries[0][1]).toContain("What is binary search?");
      expect(entries[1][1]).toContain("Frank");
      expect(entries[1][1]).toContain("Binary search is an algorithm…");
      expect(entries[2][1]).toContain("What is its complexity?");
      expect(entries[3][1]).toContain("O(log n).");
    });

    it("Back returns to Recent Conversations and refocuses the opened row", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openConversation(user, "Binary search");
      await user.click(screen.getByRole("button", { name: "Back to Recent Conversations" }));

      const list = await screen.findByRole("list", { name: "Recent conversations" });
      expect(screen.queryByRole("list", { name: "Conversation" })).not.toBeInTheDocument();
      await waitFor(() => expect(rowButton(list, "Binary search")).toHaveFocus());
      expect(historyIsOpen()).toBe(true);
    });

    it("Continue chat loads that conversation into the main input and closes history", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Harness onOpenChange={onOpenChange} />);

      await openConversation(user, "Primary colors");
      await user.click(screen.getByRole("button", { name: "Continue chat" }));

      await waitFor(() => expect(selected).toHaveBeenCalledTimes(1));
      expect((selected.mock.calls[0][0] as CustomEvent).detail).toEqual({ id: "conv_b" });
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      await waitFor(() => expect(historyIsOpen()).toBe(false));
    });

    it("reopening history always starts at Recent Conversations", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openConversation(user, "Binary search");
      await user.click(screen.getByRole("button", { name: "Close Message History" }));
      await waitFor(() => expect(historyIsOpen()).toBe(false));

      expect(await openHistory(user)).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Conversation" })).not.toBeInTheDocument();
    });

    it("wraps long messages and keeps long titles short", async () => {
      const unbroken = "A".repeat(8000);
      db.conversations = [
        {
          ...chatB,
          title: "X".repeat(5000),
          messages: [message("l1", "user", unbroken, 1), message("l2", "assistant", `https://example.com/${"x".repeat(4000)}`, 2)],
        },
      ];
      const user = userEvent.setup();
      render(<Harness />);

      const list = await openHistory(user);
      const rowTitle = list.querySelector("[data-conversation-title]")!.textContent!;
      expect(rowTitle.length).toBeLessThanOrEqual(120);
      expect(rowTitle.endsWith("…")).toBe(true);

      await user.click(within(list).getAllByRole("button")[0]);
      const transcript = await screen.findByRole("list", { name: "Conversation" });

      expect(screen.getByRole("heading").textContent!.length).toBeLessThanOrEqual(120);
      // jsdom has no layout; guard the wrapping rules that keep text in the window
      expect(transcript).toHaveClass("break-words", "[overflow-wrap:anywhere]");
      expect(transcript.closest("[class*='data-radix-scroll-area-viewport']")).not.toBeNull();
    });
  });

  describe("closing and deleting", () => {
    it("Close returns to Main Frank from either view without loading anything", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openHistory(user);
      await user.click(screen.getByRole("button", { name: "Close Message History" }));
      await waitFor(() => expect(historyIsOpen()).toBe(false));

      await openConversation(user, "Binary search");
      await user.click(screen.getByRole("button", { name: "Close Message History" }));
      await waitFor(() => expect(historyIsOpen()).toBe(false));
      expect(selected).not.toHaveBeenCalled();
    });

    it("Escape closes the history workflow", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openConversation(user, "Binary search");
      await user.keyboard("{Escape}");

      await waitFor(() => expect(historyIsOpen()).toBe(false));
    });

    it("deleting from the list confirms and never opens the conversation", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const list = await openHistory(user);
      await user.click(within(list).getByRole("button", { name: "Delete conversation Binary search" }));

      expect(screen.queryByRole("list", { name: "Conversation" })).not.toBeInTheDocument();
      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText(`Delete "Binary search"? This can't be undone.`)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(within(list).queryByText("Binary search")).not.toBeInTheDocument());
      expect(db.deleteConversation).toHaveBeenCalledWith("conv_a");
      expect(screen.queryByRole("list", { name: "Conversation" })).not.toBeInTheDocument();
      expect(historyIsOpen()).toBe(true);
      expect(selected).not.toHaveBeenCalled();
    });

    it("deleting from the conversation view returns to the list", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openConversation(user, "Binary search");
      await user.click(screen.getByRole("button", { name: "Delete conversation Binary search" }));
      await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      const list = await screen.findByRole("list", { name: "Recent conversations" });
      expect(within(list).queryByText("Binary search")).not.toBeInTheDocument();
      expect(within(list).getByText("Primary colors")).toBeInTheDocument();
    });
  });

  describe("keyboard", () => {
    it("Up/Down move between rows and Enter opens the focused conversation", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const list = await openHistory(user);
      rowButton(list, "Primary colors").focus();
      await user.keyboard("{ArrowDown}");
      expect(rowButton(list, "Binary search")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(rowButton(list, "Primary colors")).toHaveFocus();
      await user.keyboard("{ArrowDown}{Enter}");

      expect(await screen.findByRole("heading", { name: "Binary search" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back to Recent Conversations" })).toHaveFocus();
    });

    it("Space opens the focused conversation", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const list = await openHistory(user);
      rowButton(list, "Primary colors").focus();
      await user.keyboard(" ");

      expect(await screen.findByRole("heading", { name: "Primary colors" })).toBeInTheDocument();
    });
  });
});
