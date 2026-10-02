import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS } from "@/config/ai-providers.constants";
import type { Message } from "@/types";
import { fetchAIResponse } from "./ai-response.function";

vi.mock("@/lib", () => ({
  getResponseSettings: () => ({ responseLength: "", language: "" }),
  RESPONSE_LENGTHS: [],
  LANGUAGES: [],
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

const API_KEY = "sk-history-secret";
const provider = (id: string) => AI_PROVIDERS.find((p) => p.id === id)!;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
    body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }), cancel: vi.fn() }) },
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// What buildConversationContext produces for Q1 (image) → A1, then a question
const history: Message[] = [
  {
    role: "user",
    content: '[Attached image: "photo.jpg"]\n\nAnalyze this image {{API_KEY}}',
    images: [{ data: "PHOTO_DATA", mimeType: "image/jpeg" }],
  },
  { role: "assistant", content: "A red ball." },
  { role: "user", content: "Unrelated question" },
  { role: "assistant", content: "Unrelated answer" },
];

const send = async (providerId: string) => {
  for await (const _ of fetchAIResponse({
    provider: provider(providerId),
    selectedProvider: { provider: providerId, variables: { api_key: API_KEY, model: "m" } },
    systemPrompt: "BE BRIEF",
    history,
    userMessage: "What color was the object in that image?",
  })) {
    // drain
  }
  const raw = fetchMock.mock.calls[0][1].body as string;
  return { body: JSON.parse(raw), raw };
};

describe("earlier images in provider requests", () => {
  it("OpenAI: the image goes with its own earlier message, as an image_url part", async () => {
    const { body } = await send("openai");

    expect(body.messages).toHaveLength(6); // system, 4 history, current
    expect(body.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: '[Attached image: "photo.jpg"]\n\nAnalyze this image {{API_KEY}}' },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,PHOTO_DATA" } },
      ],
    });
    expect(body.messages[2]).toEqual({ role: "assistant", content: "A red ball." });
    expect(body.messages[3]).toEqual({ role: "user", content: "Unrelated question" });
    // The current question carries no image of its own
    expect(JSON.stringify(body.messages[5])).not.toContain("PHOTO_DATA");
  });

  it("Claude: the image goes with its own earlier message, as a base64 source", async () => {
    const { body } = await send("claude");

    expect(body.messages[0]).toEqual({
      role: "user",
      content: [
        { type: "text", text: '[Attached image: "photo.jpg"]\n\nAnalyze this image {{API_KEY}}' },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "PHOTO_DATA" } },
      ],
    });
    expect(body.messages[1]).toEqual({ role: "assistant", content: "A red ball." });
  });

  it("Gemini: inline_data in the earlier turn, without repeating the system prompt", async () => {
    const { body } = await send("gemini");

    expect(body.contents[0]).toEqual({
      role: "user",
      parts: [
        { text: '[Attached image: "photo.jpg"]\n\nAnalyze this image {{API_KEY}}' },
        { inline_data: { mime_type: "image/jpeg", data: "PHOTO_DATA" } },
      ],
    });
    expect(body.contents[1]).toEqual({ role: "model", parts: [{ text: "A red ball." }] });
    // The system prompt goes once, with the current question
    expect(JSON.stringify(body.contents).match(/BE BRIEF/g)).toHaveLength(1);
    expect(body.contents[body.contents.length - 1].parts[0].text).toContain("BE BRIEF");
  });

  it.each(["openai", "claude", "gemini"])(
    "%s: no provider-neutral fields leak, and text in a message is never treated as a variable",
    async (providerId) => {
      const { raw } = await send(providerId);

      expect(raw).not.toContain('"images"');
      expect(raw).toContain("{{API_KEY}}");
      expect(raw.match(new RegExp(API_KEY, "g")) ?? []).toHaveLength(0);
      expect(raw.match(/PHOTO_DATA/g)).toHaveLength(1);
    }
  );

  it("a text-only provider gets plain earlier messages", async () => {
    for await (const _ of fetchAIResponse({
      provider: provider("groq"),
      selectedProvider: { provider: "groq", variables: { api_key: API_KEY, model: "m" } },
      history: [{ role: "user", content: "Earlier" }, { role: "assistant", content: "Reply" }],
      userMessage: "Now",
    })) {
      // drain
    }
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages.slice(1, 3)).toEqual([
      { role: "user", content: "Earlier" },
      { role: "assistant", content: "Reply" },
    ]);
  });
});
