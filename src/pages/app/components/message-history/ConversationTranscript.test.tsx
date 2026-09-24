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

const LONG_NAME = `${"quarterly-financial-report-draft-".repeat(4)}final.csv`;
const UNICODE_NAME = "写真 résumé 🖼️ ñandú.png";

const msg = (id: string, role: ChatMessage["role"], content: string, timestamp: number, attachedFiles?: any): ChatMessage => ({
  id,
  role,
  content,
  timestamp,
  ...(attachedFiles !== undefined ? { attachedFiles } : {}),
});

const withFiles = msg("u1", "user", "Review these", 1_000, [
  stored("screenshot_1790253877683.png", "image/png", "image"),
  stored("holiday.jpg", "image/jpeg"), // older record: no kind
  stored("util.js", "text/javascript", "text", { text: "export const add = 1;" }),
  stored("types.ts", "video/vnd.dlna.mpeg-tts", "text", { text: "type A = 1;" }),
  stored(UNICODE_NAME, "image/png", "image"),
  stored(LONG_NAME, "text/csv", "text", { text: "a,b" }),
]);
const answer = msg("a1", "assistant", "They look fine.", 2_000);
const plainQuestion = msg("u2", "user", "And without files?", 3_000);
const emptyList = msg("a2", "assistant", "Still fine.", 4_000, []);

const renderTranscript = (messages: ChatMessage[]) => render(<ConversationTranscript messages={messages} />);
const items = () => screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-role"));

describe("ConversationTranscript attachments", () => {
  it("lists every attached file under its message, in order", () => {
    renderTranscript([withFiles, answer, plainQuestion, emptyList]);

    const list = within(items()[0]).getByRole("list", { name: "Attachments" });
    const names = within(list)
      .getAllByRole("listitem")
      .map((li) => li.querySelector(".truncate")?.textContent);
    expect(names).toEqual([
      "screenshot_1790253877683.png",
      "holiday.jpg",
      "util.js",
      "types.ts",
      UNICODE_NAME,
      LONG_NAME,
    ]);
  });

  it("marks images (including screenshots and older records) and text files", () => {
    renderTranscript([withFiles]);

    const labels = within(screen.getByRole("list", { name: "Attachments" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(labels).toEqual([
      "Image: screenshot_1790253877683.png",
      "Image: holiday.jpg",
      "File: util.js",
      // Kind wins over the type Windows reports for .ts files
      "File: types.ts",
      `Image: ${UNICODE_NAME}`,
      `File: ${LONG_NAME}`,
    ]);
  });

  it("truncates a long name visually but keeps the full name available", () => {
    renderTranscript([withFiles]);

    const chip = screen.getByTitle(LONG_NAME);
    expect(chip.querySelector(".truncate")).toHaveTextContent(LONG_NAME);
    expect(chip).toHaveClass("max-w-full", "min-w-0");
  });

  it("shows nothing extra for messages without attachments", () => {
    renderTranscript([withFiles, answer, plainQuestion, emptyList]);

    const [first, second, third, fourth] = items();
    expect(within(first).queryByRole("list", { name: "Attachments" })).toBeInTheDocument();
    for (const item of [second, third, fourth]) {
      expect(within(item).queryByRole("list", { name: "Attachments" })).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole("list", { name: "Attachments" })).toHaveLength(1);
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
    const lists = screen.getAllByRole("list", { name: "Attachments" });
    expect(lists).toHaveLength(1);
    expect(lists[0]).toHaveTextContent("File: kept.md");
  });

  it("keeps the transcript itself unchanged: order, labels and text", () => {
    renderTranscript([plainQuestion, answer, withFiles]); // stored out of order

    expect(items().map((li) => li.getAttribute("data-role"))).toEqual(["user", "assistant", "user"]);
    expect(items()[0]).toHaveTextContent(/^You.*Review these/);
    expect(items()[1]).toHaveTextContent(/^Frank.*They look fine\./);
    expect(items()[2]).toHaveTextContent(/^You.*And without files\?$/);
  });
});
