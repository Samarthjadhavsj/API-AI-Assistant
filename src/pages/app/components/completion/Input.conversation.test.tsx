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
  it("shows history oldest → newest, then the new question immediately while generating", () => {
    renderInput({ isLoading: true, pendingMessage: newQuestion });

    expect(threadText()).toEqual([
      "YouOld question",
      "AIOld answer",
      "YouNew question",
      "Generating response...",
    ]);
  });

  it("streams the new answer directly under the new question, at the bottom", () => {
    renderInput({ isLoading: true, pendingMessage: newQuestion, response: "New answer so far" });

    expect(threadText()).toEqual([
      "YouOld question",
      "AIOld answer",
      "YouNew question",
      "AINew answer so far",
    ]);
  });

  it("after saving, each message appears exactly once in chronological order", () => {
    const newAnswer = msg("a2", "assistant", "New answer", 2_001);
    const savedQuestion = msg("q2", "user", "New question", 2_000);
    renderInput({
      conversationHistory: Object.freeze([newAnswer, oldAnswer, savedQuestion, oldQuestion]),
      pendingMessage: null,
      response: "New answer",
    });

    expect(threadText()).toEqual([
      "YouOld question",
      "AIOld answer",
      "YouNew question",
      "AINew answer",
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

  it("normal (non-conversation) mode still shows just the latest answer", () => {
    renderInput({ keepEngaged: false, response: "Latest answer", pendingMessage: newQuestion });

    expect(screen.queryByTestId("conversation-thread")).not.toBeInTheDocument();
    expect(screen.getByText("Latest answer")).toBeInTheDocument();
    expect(screen.queryByText("Old question")).not.toBeInTheDocument();
    expect(screen.queryByText("New question")).not.toBeInTheDocument();
  });
});
