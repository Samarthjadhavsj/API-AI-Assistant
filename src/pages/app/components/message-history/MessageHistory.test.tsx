import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ChatConversation, ChatMessage } from "@/types/completion";

const db = vi.hoisted(() => ({
  conversations: [] as ChatConversation[],
  getAllConversations: vi.fn(),
  getConversationById: vi.fn(),
  deleteConversation: vi.fn(),
  deleteAllConversations: vi.fn(),
}));

vi.mock("@/lib", () => ({
  getAllConversations: db.getAllConversations,
  deleteConversation: db.deleteConversation,
  deleteAllConversations: db.deleteAllConversations,
  DOWNLOAD_SUCCESS_DISPLAY_MS: 1000,
}));
vi.mock("@/lib/database/chat-history.action", () => ({
  getConversationById: db.getConversationById,
}));

vi.mock("@/components", () => ({
  Button: ({ children, variant: _v, size: _s, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  ScrollArea: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Markdown: ({ children }: any) => <span>{children}</span>,
  Empty: ({ title, description, isLoading }: any) =>
    isLoading ? <p>Loading…</p> : (
      <div>
        <p>{title}</p>
        <p>{description}</p>
      </div>
    ),
}));

// Render the real route table; only stub what needs Tauri or the overlay. The
// overlay stub still applies "Continue chat", exactly as the real App does.
vi.mock("@/pages", async () => {
  const { useContinueConversationFromRoute } = await vi.importActual<
    typeof import("./useContinueConversationFromRoute")
  >("./useContinueConversationFromRoute");
  return {
    App: () => {
      useContinueConversationFromRoute();
      return <p>Overlay</p>;
    },
  };
});
vi.mock("@/pages/app/ToggleSettingsLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <Outlet /> };
});

// The registry also wires up unrelated sections; stub them so this suite only
// exercises Message History.
vi.mock("@/hooks", () => ({ useSettings: () => ({}) }));
vi.mock("@/pages/dev/components", () => ({ AIProviders: () => null }));
vi.mock("@/pages/responses/components", () => ({
  AutoScrollToggle: () => null,
  LanguageSelector: () => null,
  ResponseLength: () => null,
}));
vi.mock("@/pages/screenshot/components", () => ({ ScreenshotConfigs: () => null }));
vi.mock("@/pages/audio/components", () => ({ AudioSelection: () => null }));
vi.mock("@/pages/shortcuts/components", () => ({
  CursorSelection: () => null,
  ShortcutManager: () => null,
}));
vi.mock("@/pages/system-prompts", () => ({ SystemPromptsContent: () => null }));
vi.mock("@/pages/settings/components", () => ({ Theme: () => null }));
vi.mock("@/pages/app/components/VoiceTranscriptionSettings", () => ({
  VoiceTranscriptionSettings: () => null,
}));

import AppRoutes from "@/routes";

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

const conversation = (id: string, title: string, contents: string[]): ChatConversation => ({
  id,
  title,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  messages: contents.map((content, index) => ({
    id: `${id}-m${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content,
    timestamp: 1_700_000_000_000 + index,
  })),
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

const renderAt = (path: string, { strict = false } = {}) => {
  window.history.replaceState(null, "", path);
  return render(strict ? <StrictMode><AppRoutes /></StrictMode> : <AppRoutes />);
};

const location = () => window.location.pathname;
const list = () => screen.findByRole("list", { name: "Conversations" });
const dialog = () => screen.getByRole("alertdialog");
const dialogButton = (name: string) => within(dialog()).getByRole("button", { name });

describe("Toggle Settings → Message History", () => {
  let historyBack: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db.conversations = [
      conversation("c1", "First chat", ["Hello there", "Hi! How can I help?"]),
      conversation("c2", "Second chat", ["What is 2 + 2?", "4"]),
    ];
    db.getAllConversations.mockReset().mockImplementation(async () => [...db.conversations]);
    db.getConversationById
      .mockReset()
      .mockImplementation(async (id: string) => db.conversations.find((c) => c.id === id) ?? null);
    db.deleteConversation.mockReset().mockImplementation(async (id: string) => {
      db.conversations = db.conversations.filter((c) => c.id !== id);
      return true;
    });
    db.deleteAllConversations.mockReset().mockImplementation(async () => {
      db.conversations = [];
    });
    // Back must never pop browser history in this workflow
    historyBack = vi.spyOn(window.history, "back");
  });

  afterEach(() => {
    expect(historyBack).not.toHaveBeenCalled();
    historyBack.mockRestore();
  });

  describe("navigation", () => {
    it("lists Message History in Toggle Settings", () => {
      renderAt("/toggle/settings");

      expect(screen.getByRole("button", { name: /Message History/ })).toBeInTheDocument();
    });

    it("opens the conversation list at /toggle/settings/history", async () => {
      renderAt("/toggle/settings");

      fireEvent.click(screen.getByRole("button", { name: /Message History/ }));

      expect(location()).toBe("/toggle/settings/history");
      const rows = await list();
      expect(within(rows).getByText("First chat")).toBeInTheDocument();
      expect(within(rows).getByText("Second chat")).toBeInTheDocument();
      expect(screen.getByText("2 conversations")).toBeInTheDocument();
    });

    it("clicking a conversation opens its read-only detail view", async () => {
      renderAt("/toggle/settings/history");

      fireEvent.click(await screen.findByText("Second chat"));

      expect(location()).toBe("/toggle/settings/history/c2");
      expect(await screen.findByText("What is 2 + 2?")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Second chat" })).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(db.getConversationById).toHaveBeenCalledWith("c2");
    });

    it("Back from detail returns to the list even with no prior history entry", async () => {
      renderAt("/toggle/settings/history/c1");
      await screen.findByText("Hello there");

      fireEvent.click(screen.getByRole("button", { name: "Go back" }));

      expect(location()).toBe("/toggle/settings/history");
      expect(await list()).toBeInTheDocument();
    });

    it("Back from the list returns to Toggle Settings", async () => {
      renderAt("/toggle/settings/history");
      await screen.findByText("First chat");

      fireEvent.click(screen.getByRole("button", { name: "Go back" }));

      expect(location()).toBe("/toggle/settings");
      expect(screen.getByRole("heading", { name: "Toggle Settings" })).toBeInTheDocument();
    });

    it("walks Toggle Settings → list → detail → list → Toggle Settings", async () => {
      renderAt("/toggle/settings");

      fireEvent.click(screen.getByRole("button", { name: /Message History/ }));
      fireEvent.click(await screen.findByText("First chat"));
      await screen.findByText("Hello there");
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await list();
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));

      expect(location()).toBe("/toggle/settings");
    });

    it("shows a not-found state with Back for an unknown conversation", async () => {
      renderAt("/toggle/settings/history/missing");

      expect(await screen.findByRole("heading", { name: "Conversation not found" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      expect(location()).toBe("/toggle/settings/history");
    });
  });

  describe("Continue chat", () => {
    let selected: Mock<(event: Event) => void>;
    const settle = () => new Promise((r) => setTimeout(r, 50));

    beforeEach(() => {
      selected = vi.fn<(event: Event) => void>();
      window.addEventListener("conversationSelected", selected);
    });

    afterEach(() => {
      window.removeEventListener("conversationSelected", selected);
    });

    const selectedIds = () => selected.mock.calls.map(([event]) => (event as CustomEvent).detail);

    it("returns to the main chat and makes that conversation active", async () => {
      renderAt("/toggle/settings/history/c2");
      await screen.findByText("What is 2 + 2?");

      fireEvent.click(screen.getByRole("button", { name: /Continue chat/ }));

      expect(location()).toBe("/");
      expect(await screen.findByText("Overlay")).toBeInTheDocument();
      await waitFor(() => expect(selectedIds()).toEqual([{ id: "c2" }]));
      // Applied once: the route state is cleared so a re-render can't re-load it
      await waitFor(() => expect(window.history.state?.usr ?? null).toBeNull());
      await settle();
      expect(selected).toHaveBeenCalledTimes(1);
    });

    it("walks list → conversation → Continue chat", async () => {
      renderAt("/toggle/settings/history");

      fireEvent.click(await screen.findByText("First chat"));
      await screen.findByText("Hello there");
      fireEvent.click(screen.getByRole("button", { name: /Continue chat/ }));

      await waitFor(() => expect(selectedIds()).toEqual([{ id: "c1" }]));
      expect(location()).toBe("/");
    });

    it("loads the conversation once under Strict Mode", async () => {
      renderAt("/toggle/settings/history/c1", { strict: true });
      await screen.findByText("Hello there");

      fireEvent.click(screen.getByRole("button", { name: /Continue chat/ }));

      await waitFor(() => expect(selected).toHaveBeenCalled());
      await settle();
      expect(selectedIds()).toEqual([{ id: "c1" }]);
    });

    it("opening the main chat normally loads nothing", async () => {
      renderAt("/");

      expect(await screen.findByText("Overlay")).toBeInTheDocument();
      await settle();
      expect(selected).not.toHaveBeenCalled();
    });

    it("is not offered for a missing conversation", async () => {
      renderAt("/toggle/settings/history/missing");

      await screen.findByRole("heading", { name: "Conversation not found" });
      expect(screen.queryByRole("button", { name: /Continue chat/ })).not.toBeInTheDocument();
    });

    it("leaves the read-only view and its Delete unchanged", async () => {
      renderAt("/toggle/settings/history/c2");
      await screen.findByText("What is 2 + 2?");

      expect(screen.getByRole("button", { name: /^Delete/ })).toBeEnabled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(selected).not.toHaveBeenCalled();
    });
  });

  describe("conversation detail order", () => {
    const at = (day: number, minute: number) => new Date(2026, 8, day, 10, minute).getTime();
    const threeExchanges = (): ChatConversation => ({
      id: "c3",
      title: "Three questions",
      createdAt: at(1, 0),
      updatedAt: at(2, 31),
      messages: [
        { id: "q1", role: "user", content: "Older question", timestamp: at(1, 0) },
        { id: "a1", role: "assistant", content: "Older answer", timestamp: at(1, 1) },
        { id: "q2", role: "user", content: "Previous question", timestamp: at(2, 0) },
        { id: "a2", role: "assistant", content: "Previous answer", timestamp: at(2, 1) },
        { id: "q3", role: "user", content: "Latest question", timestamp: at(2, 30) },
        { id: "a3", role: "assistant", content: "Latest answer", timestamp: at(2, 31) },
      ],
    });
    const exchangeTexts = () =>
      Array.from(document.querySelectorAll("[data-exchange]")).map((exchange) =>
        Array.from(exchange.querySelectorAll("span"))
          .map((span) => span.textContent)
          .filter((text) => /question|answer/.test(text ?? ""))
      );

    it("shows the newest exchange first, each answer directly under its question", async () => {
      db.conversations = [threeExchanges()];
      renderAt("/toggle/settings/history/c3");
      await screen.findByText("Latest question");

      expect(exchangeTexts()).toEqual([
        ["Latest question", "Latest answer"],
        ["Previous question", "Previous answer"],
        ["Older question", "Older answer"],
      ]);
    });

    it("heads each day's exchanges with that day, newest day first", async () => {
      db.conversations = [threeExchanges()];
      renderAt("/toggle/settings/history/c3");
      await screen.findByText("Latest question");

      const exchanges = Array.from(document.querySelectorAll("[data-exchange]"));
      expect(exchanges[0]).toHaveTextContent(/^Wed, Sep 2/);
      expect(exchanges[1].textContent).not.toMatch(/Sep 2|Sep 1/);
      expect(exchanges[2]).toHaveTextContent(/^Tue, Sep 1/);
    });

    it("regression: renders the reported 4-exchange conversation newest first", async () => {
      db.conversations = [
        {
          id: "conv_reported",
          title: "hi",
          createdAt: reportedMessages[0].timestamp,
          updatedAt: reportedMessages[7].timestamp,
          messages: Object.freeze(reportedMessages.map((m) => Object.freeze({ ...m }))) as ChatMessage[],
        },
      ];
      renderAt("/toggle/settings/history/conv_reported");
      await screen.findByText(reported.q3);

      // Rendered DOM order of the message bubbles, top to bottom
      const bubbles = [...document.querySelectorAll("[data-exchange] .rounded-tr-sm, [data-exchange] .rounded-tl-sm")];
      expect(bubbles.map((bubble) => bubble.textContent)).toEqual(reportedNewestFirst);
      expect(db.conversations[0].messages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
    });

    it("never mutates or reorders the loaded conversation", async () => {
      const stored = threeExchanges();
      stored.messages = Object.freeze(stored.messages.map((m) => Object.freeze(m))) as any;
      db.conversations = [Object.freeze(stored)];
      renderAt("/toggle/settings/history/c3");
      await screen.findByText("Latest question");

      expect(stored.messages.map((m) => m.id)).toEqual(["q1", "a1", "q2", "a2", "q3", "a3"]);
    });
  });

  describe("deleting one conversation", () => {
    it("Cancel closes the confirmation without deleting", async () => {
      renderAt("/toggle/settings/history");

      fireEvent.click(await screen.findByRole("button", { name: "Delete conversation First chat" }));
      expect(within(dialog()).getByText(`Delete "First chat"? This can't be undone.`)).toBeInTheDocument();
      fireEvent.click(dialogButton("Cancel"));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(db.deleteConversation).not.toHaveBeenCalled();
      expect(within(await list()).getByText("First chat")).toBeInTheDocument();
    });

    it("the row Delete button does not open the conversation", async () => {
      renderAt("/toggle/settings/history");

      fireEvent.click(await screen.findByRole("button", { name: "Delete conversation First chat" }));

      expect(location()).toBe("/toggle/settings/history");
      expect(db.getConversationById).not.toHaveBeenCalled();
    });

    it("Confirm deletes it, removes the row, and stays on the list", async () => {
      const deleted = vi.fn();
      window.addEventListener("conversationDeleted", deleted);
      renderAt("/toggle/settings/history");

      fireEvent.click(await screen.findByRole("button", { name: "Delete conversation First chat" }));
      fireEvent.click(dialogButton("Delete"));

      await waitFor(() => expect(screen.queryByText("First chat")).not.toBeInTheDocument());
      expect(db.deleteConversation).toHaveBeenCalledWith("c1");
      expect(within(await list()).getByText("Second chat")).toBeInTheDocument();
      expect(screen.getByText("1 conversation")).toBeInTheDocument();
      expect(location()).toBe("/toggle/settings/history");
      expect(deleted).toHaveBeenCalledTimes(1);
      window.removeEventListener("conversationDeleted", deleted);
    });

    it("ignores a double-clicked Confirm and locks the dialog while deleting", async () => {
      const pending = deferred();
      db.deleteConversation.mockImplementation(async (id: string) => {
        await pending.promise;
        db.conversations = db.conversations.filter((c) => c.id !== id);
        return true;
      });
      renderAt("/toggle/settings/history");

      fireEvent.click(await screen.findByRole("button", { name: "Delete conversation First chat" }));
      const confirm = dialogButton("Delete");
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      await waitFor(() => expect(confirm).toBeDisabled());
      expect(dialogButton("Cancel")).toBeDisabled();
      expect(screen.getByRole("button", { name: /Delete All/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete conversation Second chat" })).toBeDisabled();
      expect(db.deleteConversation).toHaveBeenCalledTimes(1);

      await act(async () => pending.resolve());
      await waitFor(() => expect(screen.queryByText("First chat")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: /Delete All/ })).toBeEnabled();
    });

    it("deleting from the detail view returns to the list", async () => {
      renderAt("/toggle/settings/history/c2");
      await screen.findByText("What is 2 + 2?");

      fireEvent.click(screen.getByRole("button", { name: /^Delete/ }));
      expect(within(dialog()).getByText(`Delete "Second chat"? This can't be undone.`)).toBeInTheDocument();
      fireEvent.click(dialogButton("Delete"));

      await waitFor(() => expect(location()).toBe("/toggle/settings/history"));
      expect(db.deleteConversation).toHaveBeenCalledWith("c2");
      const rows = await list();
      expect(within(rows).queryByText("Second chat")).not.toBeInTheDocument();
      expect(within(rows).getByText("First chat")).toBeInTheDocument();
    });
  });

  describe("Delete All", () => {
    it("Cancel keeps every conversation", async () => {
      renderAt("/toggle/settings/history");
      await screen.findByText("First chat");

      fireEvent.click(screen.getByRole("button", { name: /Delete All/ }));
      expect(within(dialog()).getByText("Delete all 2 conversations? This can't be undone.")).toBeInTheDocument();
      fireEvent.click(dialogButton("Cancel"));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(db.deleteAllConversations).not.toHaveBeenCalled();
      expect(within(await list()).getAllByRole("listitem")).toHaveLength(2);
    });

    it("Confirm clears the list, shows the empty state, and emits conversationsCleared", async () => {
      const cleared = vi.fn();
      window.addEventListener("conversationsCleared", cleared);
      renderAt("/toggle/settings/history");
      await screen.findByText("First chat");

      fireEvent.click(screen.getByRole("button", { name: /Delete All/ }));
      fireEvent.click(dialogButton("Delete All"));

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      expect(db.deleteAllConversations).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Conversations" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Delete All/ })).toBeDisabled();
      expect(location()).toBe("/toggle/settings/history");
      expect(cleared).toHaveBeenCalledTimes(1);
      window.removeEventListener("conversationsCleared", cleared);
    });

    it("ignores repeated confirms and shows a locked, loading dialog while running", async () => {
      const pending = deferred();
      db.deleteAllConversations.mockImplementation(async () => {
        await pending.promise;
        db.conversations = [];
      });
      renderAt("/toggle/settings/history");
      await screen.findByText("First chat");

      fireEvent.click(screen.getByRole("button", { name: /Delete All/ }));
      const confirm = dialogButton("Delete All");
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      await waitFor(() => expect(confirm).toBeDisabled());
      expect(dialogButton("Cancel")).toBeDisabled();
      expect(confirm.querySelector(".animate-spin")).not.toBeNull();
      expect(db.deleteAllConversations).toHaveBeenCalledTimes(1);

      await act(async () => pending.resolve());
      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    });
  });

  describe("list states", () => {
    it("lists the most recently updated conversation first, oldest last", async () => {
      const newest = conversation("c3", "Newest chat", ["Latest question", "Latest answer"]);
      newest.updatedAt = 1_800_000_000_001;
      newest.messages = newest.messages.map((m, i) => ({ ...m, timestamp: 1_800_000_000_000 + i }));
      const oldest = conversation("c0", "Oldest chat", ["Very old question", "Very old answer"]);
      oldest.updatedAt = 1_600_000_000_001;
      oldest.messages = oldest.messages.map((m, i) => ({ ...m, timestamp: 1_600_000_000_000 + i }));
      // The DB hands them back out of order; the list must still be recent-first.
      db.conversations = [oldest, ...db.conversations, newest];
      renderAt("/toggle/settings/history");

      const rows = within(await list()).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("Newest chat");
      expect(rows[rows.length - 1]).toHaveTextContent("Oldest chat");

      // Opening it shows the question first, its answer under it
      fireEvent.click(within(rows[0]).getByText("Newest chat"));
      const question = await screen.findByText("Latest question");
      const answer = screen.getByText("Latest answer");
      expect(question.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows the empty state with Delete All disabled when there is no history", async () => {
      db.conversations = [];
      renderAt("/toggle/settings/history");

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      expect(screen.getByText("0 conversations")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Delete All/ })).toBeDisabled();
      expect(screen.queryByRole("list", { name: "Conversations" })).not.toBeInTheDocument();
    });

    it("does not flash the empty state and keeps Delete All disabled while loading", async () => {
      const pending = deferred();
      db.getAllConversations.mockImplementation(async () => {
        await pending.promise;
        return [...db.conversations];
      });
      renderAt("/toggle/settings/history");

      expect(screen.getByText("Loading conversations…")).toBeInTheDocument();
      expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Delete All/ })).toBeDisabled();

      await act(async () => pending.resolve());
      expect(await list()).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Delete All/ })).toBeEnabled();
    });

    it("shortens very long titles in rows and dialogs", async () => {
      const longTitle = `${"A very long first message ".repeat(400)}end`;
      db.conversations = [conversation("long", longTitle, ["hi", "hello"])];
      renderAt("/toggle/settings/history");

      const row = within(await list()).getByRole("listitem");
      const shown = row.querySelector("button span")!.textContent!;
      expect(shown.length).toBeLessThanOrEqual(120);
      expect(shown.endsWith("…")).toBe(true);

      fireEvent.click(within(row).getByRole("button", { name: /^Delete conversation/ }));
      expect(within(dialog()).getByText(/^Delete "A very long first message/).textContent!.length).toBeLessThan(160);
    });
  });
});
