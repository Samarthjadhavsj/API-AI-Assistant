import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AttachedFile, ChatMessage } from "@/types/completion";
import { ConversationTranscript } from "./ConversationTranscript";

vi.mock("@/components", () => ({
  Markdown: ({ children }: any) => <span>{children}</span>,
}));

// As persisted by the app: names and types, no image data.
const stored = (name: string, type: string, kind?: "image" | "text", extra: Partial<AttachedFile> = {}): AttachedFile => ({
  id: `id_${name}`,
  name,
  type,
  size: 100,
  base64: "",
  ...(kind ? { kind } : {}),
  ...extra,
});

const msg = (id: string, role: ChatMessage["role"], content: string, timestamp: number, attachedFiles?: any): ChatMessage => ({
  id,
  role,
  content,
  timestamp,
  ...(attachedFiles !== undefined ? { attachedFiles } : {}),
});

const withFiles = msg("u1", "user", "Review these", 1_000, [
  stored("screenshot_1790253877683.png", "image/png", "image"),
  stored("util.js", "text/javascript", "text", { text: "export const add = 1;" }),
  stored("写真 résumé.png", "image/png", "image"),
]);
const answer = msg("a1", "assistant", "They look fine.", 2_000);
const plainQuestion = msg("u2", "user", "And without files?", 3_000);
const emptyList = msg("a2", "assistant", "Still fine.", 4_000, []);

const renderTranscript = (messages: ChatMessage[]) => render(<ConversationTranscript messages={messages} />);
const items = () => screen.getAllByRole("listitem");
/** Each item's label and text, without its time. */
const texts = () => items().map((li) => li.textContent!.replace(/\d{1,2}:\d{2}\s*[AP]M/i, ""));

describe("ConversationTranscript (Conversation Mode style)", () => {
  it("shows the newest exchange first, each question followed by its answer", () => {
    renderTranscript([plainQuestion, answer, withFiles, emptyList]); // stored out of order

    expect(items().map((li) => li.getAttribute("data-role"))).toEqual(["user", "assistant", "user", "assistant"]);
    expect(texts()[0]).toMatch(/^YouAnd without files\?/);
    expect(texts()[1]).toBe("AIStill fine.");
    expect(texts()[2]).toMatch(/^YouReview these/);
    expect(texts()[3]).toBe("AIThey look fine.");
  });

  it("uses the Conversation Mode message styling", () => {
    renderTranscript([withFiles, answer]);

    const [question, reply] = items();
    expect(question).toHaveClass("p-3", "rounded-lg", "text-sm", "border-l-4", "border-primary");
    expect(reply).toHaveClass("p-3", "rounded-lg", "text-sm");
    expect(reply).not.toHaveClass("border-l-4");
  });

  it("labels attachments on their own question only", () => {
    renderTranscript([withFiles, answer, plainQuestion, emptyList]);

    const labels = screen.getAllByTestId("message-attachments");
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent("Attached: screenshot_1790253877683.png, util.js, 写真 résumé.png");
    expect(labels[0].closest("li")).toHaveTextContent("Review these");
  });

  it("never renders image data or file contents, only names", () => {
    renderTranscript([withFiles]);

    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByText(/export const add/)).not.toBeInTheDocument();
  });

  it("skips malformed attachment records without breaking the message", () => {
    renderTranscript([
      msg("u3", "user", "Legacy", 1_000, [null, { id: "x" }, { name: "  " }, stored("kept.md", "text/markdown", "text")]),
      msg("u4", "user", "Not a list", 2_000, "oops"),
    ]);

    expect(screen.getByText("Legacy")).toBeInTheDocument();
    expect(screen.getByText("Not a list")).toBeInTheDocument();
    const labels = screen.getAllByTestId("message-attachments");
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent("Attached: kept.md");
  });

  it("has no date section headers", () => {
    renderTranscript([msg("u1", "user", "Old", 1_000), msg("u2", "user", "New", 1_000 + 3 * 86_400_000)]);

    expect(screen.queryByText(/^(Today|Yesterday)$/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-day-divider]")).toBeNull();
    expect(items()).toHaveLength(2);
  });

  it("never mutates or reorders the stored messages", () => {
    const frozen = Object.freeze([withFiles, answer, plainQuestion, emptyList].map((m) => Object.freeze({ ...m })));
    const before = JSON.stringify(frozen);

    renderTranscript(frozen as unknown as ChatMessage[]);

    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("shows a streaming answer under its live question, newest first", () => {
    render(
      <ConversationTranscript
        live={{ question: msg("p1", "user", "Newest?", 5_000), answer: "", isGenerating: true }}
        messages={[plainQuestion, emptyList]}
      />
    );

    expect(texts().slice(0, 2)).toEqual(["YouNewest?", "Generating response..."]);
    expect(within(items()[1]).getByRole("status")).toHaveTextContent("Generating response...");
    expect(items()[1]).toHaveAttribute("data-streaming", "true");
  });
});
