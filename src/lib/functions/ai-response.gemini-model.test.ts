import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS } from "@/config/ai-providers.constants";
import { GEMINI_RESPONSE_MODELS } from "@/config/gemini-models.constants";
import { fetchAIResponse } from "./ai-response.function";

vi.mock("@/lib", () => ({
  getResponseSettings: () => ({ responseLength: "", language: "" }),
  RESPONSE_LENGTHS: [],
  LANGUAGES: [],
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

const gemini = AI_PROVIDERS.find((p) => p.id === "gemini")!;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const ask = async (model: string) => {
  const chunks: string[] = [];
  for await (const chunk of fetchAIResponse({
    provider: gemini,
    selectedProvider: { provider: "gemini", variables: { api_key: "k", model } },
    userMessage: "Hi",
  })) {
    chunks.push(chunk);
  }
  return { url: fetchMock.mock.calls[0][0] as string, chunks };
};

describe("Gemini AI Response model", () => {
  it.each(GEMINI_RESPONSE_MODELS.map((m) => [m.name, m.id]))(
    "%s is the model the request is sent to",
    async (_name, id) => {
      const { url, chunks } = await ask(id);

      expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`);
      expect(chunks).toEqual(["ok"]);
    }
  );

  it("sends a custom model ID as entered", async () => {
    const { url } = await ask("gemini-2.5-flash-lite");

    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent");
  });
});
