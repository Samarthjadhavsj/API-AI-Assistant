import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS } from "@/config/ai-providers.constants";
import { AIRequestError, fetchAIResponse } from "./ai-response.function";

vi.mock("@/lib", () => ({
  getResponseSettings: () => ({ responseLength: "", language: "" }),
  RESPONSE_LENGTHS: [],
  LANGUAGES: [],
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

const API_KEY = "sk-secret-$&-key";
const variables = { api_key: API_KEY, model: "test-model" };

const provider = (id: string) => {
  const p = AI_PROVIDERS.find((candidate) => candidate.id === id);
  if (!p) throw new Error(`no provider ${id}`);
  return p;
};

const encoder = new TextEncoder();

/** A minimal fetch Response: streamed SSE lines, a JSON body, or an error. */
const response = ({
  ok = true,
  status = 200,
  statusText = "OK",
  text = "",
  lines = [] as string[],
  json = {} as unknown,
}) => {
  const chunks = lines.map((line) => encoder.encode(`${line}\n`));
  return {
    ok,
    status,
    statusText,
    text: async () => text,
    json: async () => json,
    body: {
      getReader: () => ({
        read: async () =>
          chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined },
        cancel: vi.fn(),
      }),
    },
  };
};

let fetchMock: ReturnType<typeof vi.fn>;

const run = async (params: Partial<Parameters<typeof fetchAIResponse>[0]> & { providerId?: string }) => {
  const { providerId = "openai", ...rest } = params;
  const chunks: string[] = [];
  for await (const chunk of fetchAIResponse({
    provider: provider(providerId),
    selectedProvider: { provider: providerId, variables },
    userMessage: "Describe these",
    ...rest,
  })) {
    chunks.push(chunk);
  }
  return chunks;
};

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);
const sentBodyText = () => fetchMock.mock.calls[0][1].body as string;

beforeEach(() => {
  fetchMock = vi.fn(async () => response({}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const IMAGE_PROVIDERS = AI_PROVIDERS.filter((p) => p.curl.includes("{{IMAGE}}")).map((p) => p.id);

describe("image MIME types in provider requests", () => {
  it("covers every built-in provider with an image slot", () => {
    expect(IMAGE_PROVIDERS).toEqual(
      expect.arrayContaining(["openai", "claude", "grok", "gemini", "mistral", "cohere", "perplexity", "openrouter", "ollama"])
    );
  });

  it.each(IMAGE_PROVIDERS)("%s: each image is sent with its own type", async (providerId) => {
    await run({
      providerId,
      images: [
        { data: "JPEGDATA", mimeType: "image/jpeg" },
        { data: "GIFDATA", mimeType: "image/gif" },
        { data: "WEBPDATA", mimeType: "image/webp" },
      ],
    });

    const body = sentBodyText();
    for (const [data, type] of [
      ["JPEGDATA", "image/jpeg"],
      ["GIFDATA", "image/gif"],
      ["WEBPDATA", "image/webp"],
    ]) {
      // The type sits in the same image part as its data
      expect(body).toMatch(new RegExp(`\\{[^{}]*${type.replace("/", "\\/")}[^{}]*${data}[^{}]*\\}`));
      expect(body).not.toMatch(new RegExp(`\\{[^{}]*image\\/png[^{}]*${data}[^{}]*\\}`));
    }
  });

  it("still sends screenshots (plain base64) as PNG", async () => {
    await run({ providerId: "claude", imagesBase64: ["SCREENSHOT"] });
    expect(sentBody().messages[0].content).toContainEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "SCREENSHOT" },
    });
  });

  it("sends no image parts when there are no images", async () => {
    await run({ providerId: "claude" });
    expect(sentBody().messages[0].content).toEqual([{ type: "text", text: "Describe these" }]);
  });

  it("refuses images for a provider whose template has no image slot", async () => {
    await expect(run({ providerId: "groq", images: [{ data: "X", mimeType: "image/png" }] })).rejects.toThrow(
      /does not support image input/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("message text is sent exactly as written", () => {
  it("keeps $ sequences in the message (common in attached code)", async () => {
    const code = "const s = str.replace(/x/, '$&'); echo $'a'; $$('div'); cost: $5";
    await run({ userMessage: code });
    expect(sentBody().messages[1].content[0].text).toBe(code);
  });

  it("doesn't fill template variables inside the message or history", async () => {
    await run({
      userMessage: "Template: {{API_KEY}} {{MODEL}} {{SYSTEM_PROMPT}}",
      history: [{ role: "user", content: "earlier {{API_KEY}}" }],
    });
    const body = sentBody();
    expect(sentBodyText()).not.toContain("sk-secret");
    expect(body.messages[body.messages.length - 1].content[0].text).toBe("Template: {{API_KEY}} {{MODEL}} {{SYSTEM_PROMPT}}");
    expect(body.messages[1]).toEqual({ role: "user", content: "earlier {{API_KEY}}" });
    // The template's own variables are still filled in
    expect(body.model).toBe("test-model");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${API_KEY}`);
  });
});

describe("request failures", () => {
  it("throws on an HTTP error instead of returning it as the answer", async () => {
    fetchMock.mockResolvedValue(
      response({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: '{"error":{"message":"Image does not match the provided media type"}}',
      })
    );

    const chunks: string[] = [];
    const error = await (async () => {
      try {
        for await (const c of fetchAIResponse({
          provider: provider("claude"),
          selectedProvider: { provider: "claude", variables },
          userMessage: "hi",
        })) {
          chunks.push(c);
        }
      } catch (e) {
        return e;
      }
    })();

    expect(chunks).toEqual([]);
    expect(error).toBeInstanceOf(AIRequestError);
    expect((error as AIRequestError).status).toBe(400);
    expect((error as Error).message).toBe(
      'API request failed: 400 Bad Request - {"error":{"message":"Image does not match the provided media type"}}'
    );
  });

  it("shortens a very long error body", async () => {
    fetchMock.mockResolvedValue(response({ ok: false, status: 502, statusText: "Bad Gateway", text: "x".repeat(5000) }));
    await expect(run({})).rejects.toThrow(/^API request failed: 502 Bad Gateway - x{500}…$/);
  });

  it("throws on a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(run({})).rejects.toThrow("Network error during API request: Failed to fetch");
  });

  it("throws when the stream breaks, after the text received so far", async () => {
    const reads = [encoder.encode('data: {"choices":[{"delta":{"content":"Part"}}]}\n')];
    fetchMock.mockResolvedValue({
      ...response({}),
      body: {
        getReader: () => ({
          read: async () => {
            if (reads.length) return { done: false, value: reads.shift() };
            throw new Error("connection reset");
          },
          cancel: vi.fn(),
        }),
      },
    });

    const chunks: string[] = [];
    await expect(
      (async () => {
        for await (const c of fetchAIResponse({
          provider: provider("openai"),
          selectedProvider: { provider: "openai", variables },
          userMessage: "hi",
        })) {
          chunks.push(c);
        }
      })()
    ).rejects.toThrow("Error reading stream: connection reset");
    expect(chunks).toEqual(["Part"]);
  });

  it("stays silent when the request is cancelled", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort();
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    await expect(run({ signal: controller.signal })).resolves.toEqual([]);
  });

  it("still streams a normal answer", async () => {
    fetchMock.mockResolvedValue(
      response({
        lines: [
          'data: {"choices":[{"delta":{"content":"Hel"}}]}',
          'data: {"choices":[{"delta":{"content":"lo"}}]}',
          "data: [DONE]",
        ],
      })
    );
    await expect(run({})).resolves.toEqual(["Hel", "lo"]);
  });
});
