import { describe, expect, it } from "vitest";
import { AI_PROVIDERS } from "@/config/ai-providers.constants";
import type { TYPE_PROVIDER } from "@/types";
import type { AttachedFile, ChatMessage } from "@/types/completion";
import { buildConversationContext, describeOmittedImages, type ConversationImage } from "./conversation-context";

const provider = (id: string) => AI_PROVIDERS.find((p) => p.id === id) as TYPE_PROVIDER;
const MIB = 1024 * 1024;

// As saved with a message: details only, no data
const image = (id: string, name: string, size = 1000, type = "image/png"): AttachedFile => ({
  id,
  name,
  type,
  size,
  kind: "image",
  base64: "",
});
const textFile = (id: string, name: string, text: string): AttachedFile => ({
  id,
  name,
  type: "text/plain",
  size: text.length,
  kind: "text",
  base64: "",
  text,
});
const msg = (id: string, role: "user" | "assistant", content: string, attachedFiles?: AttachedFile[]): ChatMessage => ({
  id,
  role,
  content,
  timestamp: Number(id.replace(/\D/g, "")) || 1,
  ...(attachedFiles ? { attachedFiles } : {}),
});

/** Q1 (image) → A1 → Q2..Q19 → A2..A19, oldest first. */
const longConversation = (): ChatMessage[] => {
  const messages = [msg("u1", "user", "Analyze this image", [image("img_1", "photo.jpg", 2000, "image/jpeg")]), msg("a1", "assistant", "A red ball.")];
  for (let i = 2; i < 20; i++) {
    messages.push(msg(`u${i}`, "user", `Unrelated question ${i}`), msg(`a${i}`, "assistant", `Answer ${i}`));
  }
  return messages;
};
const kept = new Map<string, ConversationImage>([
  ["img_1", { data: "PHOTO_DATA", mimeType: "image/jpeg" }],
  ["img_2", { data: "CHART_DATA", mimeType: "image/png" }],
]);

describe("buildConversationContext", () => {
  it("sends an image from Q1 again with Q1, many messages later", () => {
    const { history, omitted } = buildConversationContext({
      messages: longConversation(),
      images: kept,
      provider: provider("gemini"),
    });

    expect(history).toHaveLength(38);
    expect(history[0]).toEqual({
      role: "user",
      content: '[Attached image: "photo.jpg"]\n\nAnalyze this image',
      images: [{ data: "PHOTO_DATA", mimeType: "image/jpeg" }],
    });
    // Every other message is plain text; answers never carry images
    expect(history.slice(1).every((m) => !("images" in m))).toBe(true);
    expect(history[1]).toEqual({ role: "assistant", content: "A red ball." });
    expect(omitted).toEqual([]);
  });

  it("keeps each image with the message it was attached to", () => {
    const { history } = buildConversationContext({
      messages: [
        msg("u1", "user", "First", [image("img_1", "photo.jpg", 100, "image/jpeg")]),
        msg("a1", "assistant", "Seen photo"),
        msg("u2", "user", "Second", [image("img_2", "chart.png")]),
        msg("a2", "assistant", "Seen chart"),
      ],
      images: kept,
      provider: provider("openai"),
    });

    expect(history[0].images).toEqual([{ data: "PHOTO_DATA", mimeType: "image/jpeg" }]);
    expect(history[0].content).toContain('"photo.jpg"');
    expect(history[2].images).toEqual([{ data: "CHART_DATA", mimeType: "image/png" }]);
    expect(history[2].content).toContain('"chart.png"');
  });

  it("keeps text and code files available as text in their message", () => {
    const { history } = buildConversationContext({
      messages: [msg("u1", "user", "Read this", [textFile("t1", "notes.txt", "The code is 4217.")]), msg("a1", "assistant", "OK")],
      images: new Map(),
      provider: provider("groq"),
    });

    expect(history[0].content).toContain("Attached file: notes.txt");
    expect(history[0].content).toContain("The code is 4217.");
    expect(history[0].images).toBeUndefined();
  });

  describe("provider compatibility", () => {
    it("never sends images to a provider that can't read them, and says so", () => {
      const { history, omitted } = buildConversationContext({
        messages: longConversation(),
        images: kept,
        provider: provider("groq"),
      });

      expect(history[0].images).toBeUndefined();
      expect(history[0].content).toContain(`Image "photo.jpg" was attached here but isn't included: Groq can't read images.`);
      expect(omitted).toEqual([{ name: "photo.jpg", reason: "Groq can't read images" }]);
      expect(describeOmittedImages(omitted)).toBe(
        `Earlier image not sent with this message: "photo.jpg" (Groq can't read images).`
      );
    });

    it("leaves out a format the provider doesn't accept", () => {
      const { history, omitted } = buildConversationContext({
        messages: [msg("u1", "user", "Look", [image("gif", "anim.gif", 100, "image/gif")])],
        images: new Map([["gif", { data: "GIF", mimeType: "image/gif" }]]),
        provider: provider("grok"),
      });

      expect(history[0].images).toBeUndefined();
      expect(omitted[0]).toEqual({ name: "anim.gif", reason: "Grok doesn't accept this image format" });
    });

    it("leaves out an image too large for the provider", () => {
      const { omitted } = buildConversationContext({
        messages: [msg("u1", "user", "Look", [image("big", "big.png", 9 * MIB)])],
        images: new Map([["big", { data: "BIG", mimeType: "image/png" }]]),
        provider: provider("claude"),
      });

      expect(omitted).toEqual([{ name: "big.png", reason: "it's too large for Claude" }]);
    });

    it("fits the request's total: newest images first, older ones reported", () => {
      const images = new Map([
        ["old", { data: "OLD", mimeType: "image/png" }],
        ["new", { data: "NEW", mimeType: "image/png" }],
      ]);
      const { history, omitted } = buildConversationContext({
        messages: [
          msg("u1", "user", "Old one", [image("old", "old.png", 6 * MIB)]),
          msg("a1", "assistant", "ok"),
          msg("u2", "user", "New one", [image("new", "new.png", 6 * MIB)]),
          msg("a2", "assistant", "ok"),
        ],
        images,
        provider: provider("gemini"), // 14 MiB of images per request
        currentImageBytes: 3 * MIB, // the message being sent has its own image
      });

      expect(history[2].images).toEqual([{ data: "NEW", mimeType: "image/png" }]);
      expect(history[0].images).toBeUndefined();
      expect(history[0].content).toContain(`Image "old.png" was attached here but isn't included`);
      expect(omitted.map((o) => o.name)).toEqual(["old.png"]);
    });

    it("works for a custom provider with an image slot", () => {
      const custom = { ...provider("openai"), id: "my-endpoint", isCustom: true } as TYPE_PROVIDER;
      const { history } = buildConversationContext({ messages: longConversation(), images: kept, provider: custom });

      expect(history[0].images).toEqual([{ data: "PHOTO_DATA", mimeType: "image/jpeg" }]);
    });
  });

  it("an image saved before images were kept is noted in its message, without a notice", () => {
    const { history, omitted } = buildConversationContext({
      messages: [msg("u1", "user", "Old chat", [image("legacy", "old.png")])],
      images: new Map(),
      provider: provider("openai"),
    });

    expect(history[0].images).toBeUndefined();
    expect(history[0].content).toContain(`Image "old.png" was attached here but isn't included: it wasn't kept with this conversation.`);
    expect(omitted).toEqual([{ name: "old.png", reason: "it wasn't kept with this conversation", notKept: true }]);
    expect(describeOmittedImages(omitted)).toBeNull();
  });

  it("never mutates the conversation or the kept images", () => {
    const messages = Object.freeze(longConversation().map((m) => Object.freeze({ ...m })));
    const before = JSON.stringify(messages);
    const images = new Map(kept);

    const { history } = buildConversationContext({ messages, images, provider: provider("openai") });
    history[0].images![0].data = "changed by a caller";

    expect(JSON.stringify(messages)).toBe(before);
    expect(images.get("img_1")!.data).toBe("PHOTO_DATA");
  });
});
