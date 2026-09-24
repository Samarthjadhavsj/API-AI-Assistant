import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatConversation } from "@/types/completion";

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

// Render the real route table; only stub what needs Tauri or the overlay.
vi.mock("@/pages", () => ({ App: () => <p>Overlay</p> }));
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

const renderAt = (path: string) => {
  window.history.replaceState(null, "", path);
  return render(<AppRoutes />);
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

      // Opening it still shows its messages oldest → newest
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
