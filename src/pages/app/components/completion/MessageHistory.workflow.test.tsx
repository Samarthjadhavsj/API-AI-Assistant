import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatConversation, ChatMessage } from "@/types/completion";
import { useCompletion } from "@/hooks/useCompletion";
import MessageHistoryConversation from "@/pages/app/components/message-history/MessageHistoryConversation";
import { MessageHistorySettings } from "@/pages/app/components/message-history/MessageHistorySettings";
import { useContinueConversationFromRoute } from "@/pages/app/components/message-history/useContinueConversationFromRoute";
import { Input } from "./Input";

// The real active-conversation state (useCompletion), the real input bar and
// main-bar drawer, and the real Toggle Settings pages, over an in-memory
// conversation store. Only the voice bar is reduced to a plain textarea.
const db = vi.hoisted(() => ({
  conversations: [] as ChatConversation[],
  answer: "",
}));

vi.mock("@/lib", () => ({
  fetchAIResponse: vi.fn(async function* () {
    yield db.answer;
  }),
  saveConversation: vi.fn(async (conversation: ChatConversation) => {
    db.conversations = [...db.conversations.filter((c) => c.id !== conversation.id), conversation];
  }),
  getConversationById: vi.fn(async (id: string) => db.conversations.find((c) => c.id === id) ?? null),
  generateConversationTitle: (message: string) => message.trim(),
  MESSAGE_ID_OFFSET: 1,
  generateConversationId: () => "conv_new",
  generateMessageId: (role: string, t: number) => `${role}_${t}`,
  generateRequestId: () => `req_${Math.random()}`,
  getResponseSettings: () => ({ autoScroll: true }),
  getAllConversations: vi.fn(async () => [...db.conversations]),
  deleteConversation: vi.fn(async () => true),
  deleteAllConversations: vi.fn(async () => undefined),
  DOWNLOAD_SUCCESS_DISPLAY_MS: 1000,
}));
vi.mock("@/lib/database/chat-history.action", () => ({
  getConversationById: async (id: string) => db.conversations.find((c) => c.id === id) ?? null,
}));
vi.mock("@/contexts", async () => {
  const { AI_PROVIDERS } = await vi.importActual<typeof import("@/config/ai-providers.constants")>(
    "@/config/ai-providers.constants"
  );
  return {
    useApp: () => ({
      selectedAIProvider: { provider: "claude", variables: { api_key: "k", model: "m" } },
      allAiProviders: AI_PROVIDERS,
      systemPrompt: "",
      screenshotConfiguration: { mode: "manual", autoPrompt: "", enabled: true },
      setScreenshotConfiguration: vi.fn(),
      selectedAudioDevices: {},
      selectedSttProvider: { variables: {} },
    }),
  };
});
vi.mock("@/hooks", () => ({
  useGlobalShortcuts: () => ({
    registerAudioCallback: vi.fn(),
    registerInputRef: vi.fn(),
    registerScreenshotCallback: vi.fn(),
  }),
}));
vi.mock("@/hooks/useVoiceInput", () => ({
  invokeVoiceShortcutToggle: vi.fn(),
  useVoiceInput: () => ({ state: "idle", stream: null, start: vi.fn(), stop: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("./VoiceInputBar", () => ({
  VoiceInputBar: ({ inputValue, onInputChange, onKeyPress, inputRef, uiState }: any) => (
    <div data-voice-state={uiState}>
      <textarea
        aria-label="Message input"
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyPress}
        ref={inputRef}
        value={inputValue}
      />
    </div>
  ),
}));
vi.mock("@/hooks/useWindow", () => ({ useWindowResize: () => ({ resizeWindow: vi.fn() }) }));
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
    Switch: ({ checked, onCheckedChange }: any) => (
      <button aria-checked={checked} onClick={() => onCheckedChange(!checked)} role="switch" type="button">
        Conversation mode
      </button>
    ),
    CopyButton: () => null,
    Badge: ({ children }: any) => <span>{children}</span>,
    Card: ({ children, className }: any) => <div className={className}>{children}</div>,
    Empty: ({ title, description }: any) => (
      <div>
        <p>{title}</p>
        <p>{description}</p>
      </div>
    ),
  };
});

beforeAll(() => {
  // jsdom keeps scrollTop but has no scrollTo/scrollBy; make them move it.
  HTMLElement.prototype.scrollTo = function (this: HTMLElement, options?: ScrollToOptions | number) {
    if (typeof options === "object" && typeof options.top === "number") this.scrollTop = options.top;
  } as any;
  HTMLElement.prototype.scrollBy = function (this: HTMLElement, options?: ScrollToOptions | number) {
    if (typeof options === "object" && typeof options.top === "number") this.scrollTop += options.top;
  } as any;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

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

const primaryColors: ChatConversation = {
  id: "conv_b",
  title: "A primary color?",
  createdAt: 1_700_000_500_000,
  updatedAt: 1_700_000_900_000,
  messages: [
    { id: "b1", role: "user", content: "A primary color?", timestamp: 1_700_000_500_000 },
    { id: "b2", role: "assistant", content: "Red", timestamp: 1_700_000_900_000 },
  ],
};

/** The real composer, plus readouts of the state this workflow checks. */
const Chat = () => {
  const completion = useCompletion();
  return (
    <>
      <output data-testid="answer">{completion.response}</output>
      <output data-testid="attachments">
        {completion.attachedFiles.map((file) => file.name).join(",")}
      </output>
      <output data-testid="active">{completion.currentConversationId ?? "none"}</output>
      {/* The chat's own conversation state, in its stored order */}
      <output data-testid="chat-history">
        {completion.conversationHistory.map((m) => m.content).join(" | ")}
      </output>
      <Input
        {...completion}
        isHidden={false}
        trailingControls={
          <input aria-label="Attach files" onChange={completion.handleFileSelect} type="file" />
        }
      />
    </>
  );
};

/** Like App: the parent of the chat applies "Continue chat" from Settings. */
const Main = () => {
  useContinueConversationFromRoute();
  return (
    <>
      {/* Stands in for the main bar's settings gear */}
      <Link to="/toggle/settings/history">Open settings</Link>
      <Chat />
    </>
  );
};

const renderApp = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Main />} path="/" />
        <Route element={<MessageHistorySettings />} path="/toggle/settings/history" />
        <Route
          element={<MessageHistoryConversation />}
          path="/toggle/settings/history/:conversationId"
        />
      </Routes>
    </MemoryRouter>
  );

type User = ReturnType<typeof userEvent.setup>;

const drawer = () => screen.queryByRole("dialog", { name: "Current conversation" });
const openDrawer = async (user: User) => {
  await user.click(screen.getByRole("button", { name: "Message History" }));
  return screen.findByRole("dialog", { name: "Current conversation" });
};
const active = () => screen.getByTestId("active").textContent;
const messageInput = () => screen.getByLabelText("Message input");
/** Message items in the drawer, in display order, without their times. */
const thread = (view: HTMLElement) =>
  within(view)
    .getAllByRole("listitem")
    .filter((li) => li.hasAttribute("data-role"))
    .map((li) => li.textContent!.replace(/\d{1,2}:\d{2}\s*[AP]M/i, ""));
const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])], "diagram.png", {
    type: "image/png",
  });

describe("Message History workflow: main bar ↔ Toggle Settings", () => {
  beforeEach(() => {
    db.conversations = [primaryColors];
    db.answer = "Binary search halves the range each step.";
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // One long user journey, so it gets more than the default 5s on a busy run.
  it("current conversation → all conversations → Continue chat → New chat", async () => {
    const user = userEvent.setup();
    renderApp();

    // Before chatting there is no current conversation
    expect(within(await openDrawer(user)).getByText("No conversation yet")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());

    // 1. Chat in Frank
    await user.type(messageInput(), "What is binary search?{Enter}");
    await waitFor(() => expect(active()).toBe("conv_new"));
    const answer = "Binary search halves the range each step.";
    expect(screen.getByTestId("answer")).toHaveTextContent(answer);

    // A follow-up draft with an attachment, not sent yet
    await user.type(messageInput(), "And its complexity?");
    await user.upload(screen.getByLabelText("Attach files"), png());
    await waitFor(() => expect(screen.getByTestId("attachments")).toHaveTextContent("diagram.png"));

    // 2–3. Message History shows the current conversation only
    let view = await openDrawer(user);
    expect(thread(view)).toEqual(["YouWhat is binary search?", `AI${answer}`]);
    expect(within(view).queryByText("A primary color?")).not.toBeInTheDocument();

    // 4. Closing returns to exactly the previous composer/chat state
    await user.click(within(view).getByRole("button", { name: "Close Message History" }));
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(messageInput()).toHaveValue("And its complexity?");
    expect(screen.getByTestId("answer")).toHaveTextContent(answer);
    expect(screen.getByTestId("attachments")).toHaveTextContent("diagram.png");
    expect(active()).toBe("conv_new");

    // 5. Toggle Settings → Message History
    await user.click(screen.getByRole("link", { name: "Open settings" }));
    const list = await screen.findByRole("list", { name: "Conversations" });
    expect(within(list).getByText("What is binary search?")).toBeInTheDocument();

    // 6–7. Pick another conversation and continue it
    await user.click(within(list).getByText("A primary color?"));
    await screen.findByText("Red");
    await user.click(screen.getByRole("button", { name: /Continue chat/ }));

    await waitFor(() => expect(active()).toBe("conv_b"));
    expect(screen.getByTestId("answer")).toHaveTextContent("Red");
    // The main chat keeps its normal chronological order
    expect(screen.getByTestId("chat-history")).toHaveTextContent("A primary color? | Red");

    // 8. The main Message History now shows the newly active conversation
    view = await openDrawer(user);
    expect(thread(view)).toEqual(["YouA primary color?", "AIRed"]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());

    // A follow-up is appended after the existing messages, its answer under it
    db.answer = "Blue and yellow too.";
    await user.type(messageInput(), "Any others?{Enter}");
    await waitFor(() => expect(screen.getByTestId("answer")).toHaveTextContent("Blue and yellow too."));
    await waitFor(() =>
      expect(db.conversations.find((c) => c.id === "conv_b")?.messages).toHaveLength(4)
    );
    // Opened right away: the input's refocus 100ms after an answer must not
    // close the drawer.
    view = await openDrawer(user);
    await new Promise((r) => setTimeout(r, 150));
    expect(drawer()).toBeInTheDocument();
    // Message History: newest exchange first, each answer under its question
    expect(thread(view)).toEqual([
      "YouAny others?",
      "AIBlue and yellow too.",
      "YouA primary color?",
      "AIRed",
    ]);
    // ...while the chat state and the saved conversation stay chronological
    expect(screen.getByTestId("chat-history")).toHaveTextContent(
      "A primary color? | Red | Any others? | Blue and yellow too."
    );
    expect(db.conversations.find((c) => c.id === "conv_b")!.messages.map((m) => m.content)).toEqual([
      "A primary color?",
      "Red",
      "Any others?",
      "Blue and yellow too.",
    ]);

    // 9. New Chat empties the current-conversation view until a message is sent
    const saved = structuredClone(db.conversations);
    await user.click(within(view).getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(active()).toBe("none");
    expect(within(await openDrawer(user)).getByText("No conversation yet")).toBeInTheDocument();
    // ...and leaves every saved conversation as it was
    expect(db.conversations).toEqual(saved);
  }, 30_000);

  // The path reproduced in the running app: Settings → open → Continue chat →
  // main bar Message History, with the reported conversation.
  it("regression: the reported conversation is newest-first in Settings and in Message History", async () => {
    const user = userEvent.setup();
    db.conversations = [
      {
        id: "conv_reported",
        title: "hi",
        createdAt: reportedMessages[0].timestamp,
        updatedAt: reportedMessages[7].timestamp,
        messages: reportedMessages,
      },
    ];
    render(
      <MemoryRouter initialEntries={["/toggle/settings/history"]}>
        <Routes>
          <Route element={<Main />} path="/" />
          <Route element={<MessageHistorySettings />} path="/toggle/settings/history" />
          <Route
            element={<MessageHistoryConversation />}
            path="/toggle/settings/history/:conversationId"
          />
        </Routes>
      </MemoryRouter>
    );

    await user.click(within(await screen.findByRole("list", { name: "Conversations" })).getByText("hi"));
    await screen.findByText(reported.q3);
    const bubbles = [...document.querySelectorAll("[data-exchange] .rounded-tr-sm, [data-exchange] .rounded-tl-sm")];
    expect(bubbles.map((bubble) => bubble.textContent)).toEqual(reportedNewestFirst);

    await user.click(screen.getByRole("button", { name: /Continue chat/ }));
    await waitFor(() => expect(active()).toBe("conv_reported"));
    // The main chat keeps its normal chronological order
    expect(screen.getByTestId("chat-history")).toHaveTextContent(
      reportedMessages.map((m) => m.content).join(" | ")
    );

    const view = await openDrawer(user);
    expect(thread(view)).toEqual(
      reportedNewestFirst.map((text, index) => `${index % 2 === 0 ? "You" : "AI"}${text}`)
    );
    expect(db.conversations[0].messages).toBe(reportedMessages);
  }, 30_000);

  describe("regression: drawer reading position after Continue chat + Conversation Mode", () => {
    const drawerViewport = () =>
      drawer()!.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]")!;
    /** The reader scrolls the drawer (a real scroll event, as a wheel would fire). */
    const readerScrollsTo = (top: number) => {
      const viewport = drawerViewport();
      viewport.scrollTop = top;
      fireEvent.scroll(viewport);
    };
    const icon = () => screen.getByRole("button", { name: "Message History" });
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    const closedWith = async (action: () => Promise<void>) => {
      await action();
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    };

    const secondConversation: ChatConversation = {
      id: "conv_second",
      title: "Second chat",
      createdAt: 1790940000000,
      updatedAt: 1790940000001,
      messages: [
        { id: "s1", role: "user", content: "Second chat question", timestamp: 1790940000000 },
        { id: "s2", role: "assistant", content: "Second chat answer", timestamp: 1790940000001 },
      ],
    };

    // The exact reported flow, end to end through the real composer and pages.
    it("Settings → Continue chat → Conversation Mode → open, scroll, icon close, reopen: exact position", async () => {
      const user = userEvent.setup();
      // Frozen: nothing may sort or edit the stored conversation in place
      const stored = Object.freeze(reportedMessages.map((m) => Object.freeze({ ...m })));
      db.conversations = [
        {
          id: "conv_reported",
          title: "hi",
          createdAt: stored[0].timestamp,
          updatedAt: stored[7].timestamp,
          messages: stored as unknown as ChatMessage[],
        },
        secondConversation,
      ];
      db.answer = "Right now.";
      render(
        <MemoryRouter initialEntries={["/toggle/settings/history"]}>
          <Routes>
            <Route element={<Main />} path="/" />
            <Route element={<MessageHistorySettings />} path="/toggle/settings/history" />
            <Route element={<MessageHistoryConversation />} path="/toggle/settings/history/:conversationId" />
          </Routes>
        </MemoryRouter>
      );

      // 1–3. Toggle Settings → Message History → select → Continue chat
      const list = await screen.findByRole("list", { name: "Conversations" });
      await user.click(within(list).getByText("hi"));
      await screen.findByText(reported.q3);
      await user.click(screen.getByRole("button", { name: /Continue chat/ }));
      await waitFor(() => expect(active()).toBe("conv_reported"));

      // 4–5. Conversation Mode ON: the thread is newest-first
      await user.click(screen.getByRole("switch"));
      await screen.findByText("Conversation Mode");
      const conversationThread = () =>
        [...screen.getByTestId("conversation-thread").querySelectorAll("[data-role]")].map(
          (el) => el.lastElementChild?.textContent
        );
      expect(conversationThread()).toEqual(reportedNewestFirst);

      // 6–7. The icon opens the current conversation, starting at the newest
      await user.click(icon());
      await screen.findByRole("dialog", { name: "Current conversation" });
      await nextFrame();
      expect(drawerViewport().scrollTop).toBe(0);
      expect(thread(drawer()!)[0]).toBe(`You${reported.q4}`);

      // 8–10. Scroll to the middle, close with the same icon, reopen: same spot
      readerScrollsTo(450);
      await closedWith(() => user.click(icon()));
      expect(icon()).toHaveFocus();
      // The icon tucks the Conversation Mode panel away too, clearing nothing
      expect(screen.queryByText("Conversation Mode")).not.toBeInTheDocument();
      expect(active()).toBe("conv_reported");
      expect(screen.getByTestId("answer")).toHaveTextContent(reported.a4);
      await user.click(icon());
      await screen.findByRole("dialog", { name: "Current conversation" });
      expect(drawerViewport().scrollTop).toBe(450);
      await nextFrame();
      expect(drawerViewport().scrollTop).toBe(450);

      // Escape keeps it
      readerScrollsTo(300);
      await closedWith(() => user.keyboard("{Escape}"));
      expect(icon()).toHaveFocus();
      // Closing any other way shows the Conversation Mode panel again
      expect(screen.getByText("Conversation Mode")).toBeInTheDocument();
      await user.click(icon());
      await screen.findByRole("dialog", { name: "Current conversation" });
      expect(drawerViewport().scrollTop).toBe(300);

      // Close keeps it
      readerScrollsTo(200);
      await closedWith(() =>
        user.click(within(drawer()!).getByRole("button", { name: "Close Message History" }))
      );
      await user.click(icon());
      await screen.findByRole("dialog", { name: "Current conversation" });
      expect(drawerViewport().scrollTop).toBe(200);
      await closedWith(() => user.click(icon()));

      // A new question after reopening follows the newest-first rules
      await user.type(messageInput(), "and now?{Enter}");
      await waitFor(() => expect(db.conversations.find((c) => c.id === "conv_reported")!.messages).toHaveLength(10));
      await waitFor(() => expect(conversationThread()[0]).toBe("and now?"));
      expect(conversationThread().slice(0, 3)).toEqual(["and now?", "Right now.", reported.q4]);
      await user.click(icon());
      await screen.findByRole("dialog", { name: "Current conversation" });
      await nextFrame();
      expect(drawerViewport().scrollTop).toBe(0);
      expect(thread(drawer()!).slice(0, 2)).toEqual(["Youand now?", "AIRight now."]);

      // The stored conversation was never mutated; the chat itself stays chronological
      expect(stored.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
      expect(screen.getByTestId("chat-history")).toHaveTextContent(
        [...reportedMessages.map((m) => m.content), "and now?", "Right now."].join(" | ")
      );

      // Switching conversations: Toggle Settings → another conversation → Continue chat
      await user.click(screen.getByRole("link", { name: "Open settings" }));
      const again = await screen.findByRole("list", { name: "Conversations" });
      await user.click(within(again).getByText("Second chat"));
      await screen.findByText("Second chat answer");
      await user.click(screen.getByRole("button", { name: /Continue chat/ }));
      await waitFor(() => expect(active()).toBe("conv_second"));
      await user.click(icon());
      await screen.findByRole("dialog", { name: "Current conversation" });
      await nextFrame();
      // Its own thread, from its newest exchange
      expect(drawerViewport().scrollTop).toBe(0);
      expect(thread(drawer()!)[0]).toBe("YouSecond chat question");
      readerScrollsTo(120);
      await closedWith(() => user.click(icon()));
      await user.click(icon());
      await screen.findByRole("dialog", { name: "Current conversation" });
      expect(drawerViewport().scrollTop).toBe(120);
    }, 60_000);
  });

  describe("regression: ONE Message History drawer after Continue chat + Conversation Mode", () => {
    const historyIcons = () => screen.getAllByRole("button", { name: "Message History" });
    const drawerContents = () => document.querySelectorAll('[data-message-history="current"]');
    const surfaces = () => [...document.querySelectorAll("[data-radix-popper-content-wrapper]")];
    const conversationModePanel = () => screen.queryByText("Conversation Mode");
    const drawerViewport = () =>
      drawer()!.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]")!;
    const shownQuestions = () =>
      [...drawer()!.querySelectorAll('li[data-role="user"]')].map((li) => li.lastElementChild?.textContent);
    /** Exactly one Message History trigger, and the drawer as the only surface. */
    const expectOneDrawerOnly = () => {
      expect(historyIcons()).toHaveLength(1);
      expect(drawerContents()).toHaveLength(1);
      expect(surfaces()).toHaveLength(1);
      expect(surfaces()[0].contains(drawer())).toBe(true);
      expect(conversationModePanel()).not.toBeInTheDocument();
    };

    it("Settings → Continue chat → Conversation Mode → the icon toggles ONE drawer, keeping everything", async () => {
      const user = userEvent.setup();
      const stored = Object.freeze(reportedMessages.map((m) => Object.freeze({ ...m })));
      db.conversations = [
        {
          id: "conv_reported",
          title: "hi",
          createdAt: stored[0].timestamp,
          updatedAt: stored[7].timestamp,
          messages: stored as unknown as ChatMessage[],
        },
      ];
      render(
        <MemoryRouter initialEntries={["/toggle/settings/history"]}>
          <Routes>
            <Route element={<Main />} path="/" />
            <Route element={<MessageHistorySettings />} path="/toggle/settings/history" />
            <Route element={<MessageHistoryConversation />} path="/toggle/settings/history/:conversationId" />
          </Routes>
        </MemoryRouter>
      );

      // Toggle Settings → select → Continue chat: no extra history UI is created
      await user.click(within(await screen.findByRole("list", { name: "Conversations" })).getByText("hi"));
      await screen.findByText(reported.q3);
      await user.click(screen.getByRole("button", { name: /Continue chat/ }));
      await waitFor(() => expect(active()).toBe("conv_reported"));
      expect(historyIcons()).toHaveLength(1);
      expect(drawerContents()).toHaveLength(0);
      const icon = historyIcons()[0]; // the ONE MessageHistory's trigger, for identity checks

      // A draft and an attachment to keep
      await user.type(messageInput(), "my draft");
      await user.upload(screen.getByLabelText("Attach files"), png());
      await waitFor(() => expect(screen.getByTestId("attachments")).toHaveTextContent("diagram.png"));

      // Conversation Mode ON
      await user.click(screen.getByRole("switch"));
      expect(conversationModePanel()).toBeInTheDocument();

      // 1. The icon → exactly ONE drawer, the only surface (the Conversation Mode panel is not mounted)
      await user.click(icon);
      const opened = await screen.findByRole("dialog", { name: "Current conversation" });
      expectOneDrawerOnly();
      expect(shownQuestions()[0]).toBe(reported.q4);

      // The drawer has no search or other interface of its own
      expect(within(opened).queryByRole("textbox")).not.toBeInTheDocument();
      expect(shownQuestions()).toEqual([reported.q4, reported.q3, reported.q2, reported.q1]);
      expect(db.conversations[0].messages).toHaveLength(8);
      expectOneDrawerOnly();
      fireEvent.scroll(Object.assign(drawerViewport(), { scrollTop: 300 }));

      // 2. The same icon → the drawer closes, leaving only the bar
      await user.click(historyIcons()[0]);
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      expect(drawerContents()).toHaveLength(0);
      expect(surfaces()).toHaveLength(0);

      // 3, 8–9. The same icon → the same component's drawer reopens, at its position
      expect(historyIcons()[0]).toBe(icon);
      await user.click(icon);
      await screen.findByRole("dialog", { name: "Current conversation" });
      expectOneDrawerOnly();
      expect(historyIcons()[0]).toBe(icon);
      expect(drawerViewport().scrollTop).toBe(300);

      // 6. Conversation Mode OFF and ON: still the one implementation, never two surfaces
      await user.keyboard("{Escape}"); // closing another way brings the panel back
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      expect(conversationModePanel()).toBeInTheDocument();
      await user.click(screen.getByRole("switch")); // OFF
      await screen.findByText("AI Response");
      await user.click(icon);
      await screen.findByRole("dialog", { name: "Current conversation" });
      expectOneDrawerOnly();
      expect(screen.queryByText("AI Response")).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(drawer()).not.toBeInTheDocument());
      await user.click(screen.getByRole("switch")); // ON again
      await user.click(icon);
      await screen.findByRole("dialog", { name: "Current conversation" });
      expectOneDrawerOnly();
      expect(historyIcons()[0]).toBe(icon);

      // 10. Draft, answer and attachments kept throughout; stored order untouched
      expect(messageInput()).toHaveValue("my draft");
      expect(screen.getByTestId("answer")).toHaveTextContent(reported.a4);
      expect(screen.getByTestId("attachments")).toHaveTextContent("diagram.png");
      expect(stored.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
    }, 60_000);
  });
});
