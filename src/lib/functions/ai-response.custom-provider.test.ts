import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS } from "@/config/ai-providers.constants";
import { fetchAIResponse } from "./ai-response.function";
import type { TYPE_PROVIDER } from "@/types";

vi.mock("@/lib", () => ({
  getResponseSettings: () => ({ responseLength: "", language: "" }),
  RESPONSE_LENGTHS: [],
  LANGUAGES: [],
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ output: { answer: "custom answer" } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const ask = async (provider: TYPE_PROVIDER, variables: Record<string, string>) => {
  const chunks: string[] = [];
  for await (const chunk of fetchAIResponse({
    provider,
    selectedProvider: { provider: provider.id!, variables },
    userMessage: "What is 2+2?",
  })) {
    chunks.push(chunk);
  }
  const [url, init] = fetchMock.mock.calls[0];
  return { url, init, body: JSON.parse(init.body), chunks };
};

describe("Custom AI provider requests", () => {
  const custom: TYPE_PROVIDER = {
    id: "custom-123",
    isCustom: true,
    name: "My LLM",
    streaming: false,
    responseContentPath: "output.answer",
    curl: `curl "https://llm.example.com/v1/generate" -H "Authorization: Bearer {{API_KEY}}" -H "X-Region: {{REGION}}" -d '{"model": "{{MODEL}}", "prompt": "{{TEXT}}"}'`,
  };

  it("goes to the custom endpoint with its model, key and extra fields, and reads its response path", async () => {
    const { url, init, body, chunks } = await ask(custom, { api_key: "my-key", model: "my-model", region: "eu" });

    expect(url).toBe("https://llm.example.com/v1/generate");
    expect(init.headers.Authorization).toBe("Bearer my-key");
    expect(init.headers["X-Region"]).toBe("eu");
    expect(body).toEqual({ model: "my-model", prompt: "What is 2+2?" });
    expect(chunks).toEqual(["custom answer"]);
  });

  it("a message typed with template-like text is sent exactly as written", async () => {
    const chunks: string[] = [];
    for await (const chunk of fetchAIResponse({
      provider: custom,
      selectedProvider: { provider: custom.id!, variables: { api_key: "k", model: "m", region: "eu" } },
      userMessage: "Explain {{TEXT}} and {{API_KEY}} and $&",
    })) {
      chunks.push(chunk);
    }
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.prompt).toBe("Explain {{TEXT}} and {{API_KEY}} and $&");
  });

  it("a system prompt containing {{TEXT}} is sent as written, not filled with the message", async () => {
    const withSystem: TYPE_PROVIDER = {
      ...custom,
      curl: `curl "https://llm.example.com/v1/generate" -d '{"model": "{{MODEL}}", "system": "{{SYSTEM_PROMPT}}", "prompt": "{{TEXT}}"}'`,
    };
    for await (const _ of fetchAIResponse({
      provider: withSystem,
      selectedProvider: { provider: withSystem.id!, variables: { model: "m" } },
      systemPrompt: "Quote {{TEXT}} literally.",
      userMessage: "hello",
    })) {
      // drain
    }
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toEqual({ model: "m", system: "Quote {{TEXT}} literally.", prompt: "hello" });
  });

  it("refuses to send while a variable the endpoint needs is missing", async () => {
    await expect(ask(custom, { api_key: "my-key", model: "my-model" })).rejects.toThrow(
      "Missing required variable: region"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the active built-in provider's own settings reach its API", () => {
  it("Claude: its endpoint, key header and model", async () => {
    const claude = AI_PROVIDERS.find((p) => p.id === "claude")!;
    fetchMock.mockImplementation(async () => ({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true }), cancel: vi.fn() }) },
    }));

    const { url, init, body } = await ask(claude, { api_key: "claude-key", model: "claude-model-x" });

    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("claude-key");
    expect(body.model).toBe("claude-model-x");
  });

  it("Claude: a system prompt containing {{TEXT}} reaches its system field as written", async () => {
    const claude = AI_PROVIDERS.find((p) => p.id === "claude")!;
    fetchMock.mockImplementation(async () => ({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true }), cancel: vi.fn() }) },
    }));

    for await (const _ of fetchAIResponse({
      provider: claude,
      selectedProvider: { provider: "claude", variables: { api_key: "claude-key", model: "m" } },
      systemPrompt: "Quote {{TEXT}} literally.",
      userMessage: "hello",
    })) {
      // drain
    }

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe("Quote {{TEXT}} literally.");
  });
});
