import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/types/completion";
import { Input } from "./Input";

vi.mock("@/components", () => ({
  Popover: ({ children }: any) => <>{children}</>,
  PopoverAnchor: ({ children }: any) => <>{children}</>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  ScrollArea: ({ children }: any) => <div>{children}</div>,
  Markdown: ({ children }: any) => <span>{children}</span>,
  Switch: () => null,
  CopyButton: () => null,
}));
vi.mock("@/components/ui/popover", () => ({
  TransparentPopoverContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("./MessageHistory", () => ({ MessageHistory: () => null }));
vi.mock("./VoiceInputBar", () => ({ VoiceInputBar: () => null }));
vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({ state: "idle", stream: null, start: vi.fn(), stop: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("@/contexts", () => ({
  useApp: () => ({ selectedAudioDevices: {}, selectedSttProvider: { variables: {} } }),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

const msg = (id: string, role: "user" | "assistant", content: string, timestamp: number): ChatMessage => ({
  id,
  role,
  content,
  timestamp,
});

const oldQuestion = msg("q1", "user", "Old question", 1_000);
const oldAnswer = msg("a1", "assistant", "Old answer", 1_001);
const newQuestion = msg("pending_1", "user", "New question", 2_000);

const renderInput = (overrides: Record<string, unknown>) =>
  render(
    <Input
      {...({
        isPopoverOpen: true,
        isLoading: false,
        reset: vi.fn(),
        input: "",
        setInput: vi.fn(),
        handleKeyPress: vi.fn(),
        handlePaste: vi.fn(),
        currentConversationId: "conv_1",
        // Stored newest-first on purpose, and frozen: sorting it in place would throw.
        conversationHistory: Object.freeze([oldAnswer, oldQuestion]),
        pendingMessage: null,
        startNewConversation: vi.fn(),
        messageHistoryOpen: false,
        setMessageHistoryOpen: vi.fn(),
        error: null,
        response: "",
        cancel: vi.fn(),
        scrollAreaRef: createRef(),
        inputRef: createRef(),
        isHidden: false,
        keepEngaged: true,
        setKeepEngaged: vi.fn(),
        ...overrides,
      } as any)}
    />
  );

const threadText = () =>
  Array.from(screen.getByTestId("conversation-thread").children).map((el) =>
    (el.textContent ?? "").replace(/\d{1,2}:\d{2}\s*(AM|PM)?/i, "").trim()
  );

describe("Input conversation thread", () => {
  it("shows the new question on top immediately while generating, then older exchanges", () => {
    renderInput({ isLoading: true, pendingMessage: newQuestion });

    expect(threadText()).toEqual([
      "YouNew question",
      "Generating response...",
      "YouOld question",
      "AIOld answer",
    ]);
  });

  it("streams the new answer directly under the new question, at the top", () => {
    renderInput({ isLoading: true, pendingMessage: newQuestion, response: "New answer so far" });

    expect(threadText()).toEqual([
      "YouNew question",
      "AINew answer so far",
      "YouOld question",
      "AIOld answer",
    ]);
  });

  it("after saving, each message appears exactly once, newest exchange first", () => {
    const newAnswer = msg("a2", "assistant", "New answer", 2_001);
    const savedQuestion = msg("q2", "user", "New question", 2_000);
    renderInput({
      conversationHistory: Object.freeze([newAnswer, oldAnswer, savedQuestion, oldQuestion]),
      pendingMessage: null,
      response: "New answer",
    });

    expect(threadText()).toEqual([
      "YouNew question",
      "AINew answer",
      "YouOld question",
      "AIOld answer",
    ]);
  });

  it("shows an error below the question it belongs to", () => {
    renderInput({ pendingMessage: newQuestion, error: "Network down" });

    const thread = threadText();
    expect(thread.indexOf("YouNew question")).toBeLessThan(thread.findIndex((t) => t.includes("Network down")));
  });

  it("does not reorder the history array it was given", () => {
    // Oldest-first, as stored: the previous newest-first in-place sort reversed it.
    const history = [oldQuestion, oldAnswer];
    renderInput({ conversationHistory: history, pendingMessage: newQuestion, isLoading: true });

    expect(history).toEqual([oldQuestion, oldAnswer]);
  });

  it("lists what was attached to a question, sent or loaded from history", () => {
    const attached = (name: string) => ({ id: name, name, type: "image/png", kind: "image" as const, base64: "", size: 1 });
    const savedWithFile = { ...oldQuestion, attachedFiles: [attached("chart.png"), attached("data.csv")] };
    const pendingWithFile = { ...newQuestion, attachedFiles: [attached("screen.png")] };
    renderInput({
      conversationHistory: Object.freeze([oldAnswer, savedWithFile]),
      pendingMessage: pendingWithFile,
      isLoading: true,
    });

    // Newest first, and each list stays with its own question
    const lists = screen.getAllByTestId("message-attachments");
    expect(lists.map((el) => el.textContent)).toEqual(["Attached: screen.png", "Attached: chart.png, data.csv"]);
    expect(lists[0].closest("[data-role]")).toHaveTextContent("New question");
    expect(lists[1].closest("[data-role]")).toHaveTextContent("Old question");
  });

  it("regression: renders the reported 4-exchange conversation newest first", () => {
    const at = [1790949451684, 1790951152718, 1790951963307, 1790959600725];
    const texts = [
      ["hi", "Hi there! How can I help you today?"],
      ["hi hey can you give me leetcode 100 th ans", "Hello! It looks like you're referring to LeetCode problem #100."],
      ["hi can you tell what time is now", "Hello! I don't have access to real-time clocks."],
      ["hi", "Hi there! How can I help you today?"],
    ];
    // As stored and as sent to the AI: oldest → newest
    const stored = Object.freeze(
      texts.flatMap(([question, answer], i) => [
        Object.freeze(msg(`q${i + 1}`, "user", question, at[i])),
        Object.freeze(msg(`a${i + 1}`, "assistant", answer, at[i] + 1)),
      ])
    );
    renderInput({ conversationHistory: stored, pendingMessage: null, response: texts[3][1] });

    // Final rendered DOM order, top to bottom
    const items = [...screen.getByTestId("conversation-thread").querySelectorAll("[data-role]")];
    // Each item: its label row, then the message text as its last child
    expect(items.map((el) => [el.getAttribute("data-role"), el.lastElementChild?.textContent])).toEqual([
      ["user", "hi"],
      ["assistant", "Hi there! How can I help you today?"],
      ["user", "hi can you tell what time is now"],
      ["assistant", "Hello! I don't have access to real-time clocks."],
      ["user", "hi hey can you give me leetcode 100 th ans"],
      ["assistant", "Hello! It looks like you're referring to LeetCode problem #100."],
      ["user", "hi"],
      ["assistant", "Hi there! How can I help you today?"],
    ]);
    expect(items[0]).toHaveTextContent(/10:16/);
    expect(items[6]).toHaveTextContent(/07:27/);
    // The stored / sent order is untouched
    expect(stored.map((m) => m.id)).toEqual(["q1", "a1", "q2", "a2", "q3", "a3", "q4", "a4"]);
  });

  it("normal (non-conversation) mode still shows just the latest answer", () => {
    renderInput({ keepEngaged: false, response: "Latest answer", pendingMessage: newQuestion });

    expect(screen.queryByTestId("conversation-thread")).not.toBeInTheDocument();
    expect(screen.getByText("Latest answer")).toBeInTheDocument();
    expect(screen.queryByText("Old question")).not.toBeInTheDocument();
    expect(screen.queryByText("New question")).not.toBeInTheDocument();
  });
});
