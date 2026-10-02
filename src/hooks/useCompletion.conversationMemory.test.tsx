import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatConversation } from "@/types/completion";
import { useCompletion } from "./useCompletion";

/**
 * Conversation memory, end to end: real file reading, the real useCompletion
 * save + history rebuild, and the real fetchAIResponse with the real provider
 * templates. Only SQLite and the network are in-memory fakes; the fake store
 * outlives a hook instance, as the database outlives an app restart.
 */
const store = vi.hoisted(() => ({
  conversations: new Map<string, ChatConversation>(),
  images: new Map<string, Map<string, { messageId: string; name: string; data: string; mimeType: string }>>(),
  loads: [] as string[],
  ids: 0,
  real: { fetchAIResponse: null as any },
}));
const app = vi.hoisted(() => ({ provider: "gemini" }));
const API_KEY = "k-memory-secret";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@/contexts", async () => {
  const { AI_PROVIDERS } = await vi.importActual<typeof import("@/config/ai-providers.constants")>(
    "@/config/ai-providers.constants"
  );
  return {
    useApp: () => ({
      selectedAIProvider: { provider: app.provider, variables: { api_key: API_KEY, model: "m" } },
      allAiProviders: AI_PROVIDERS,
      systemPrompt: "",
      screenshotConfiguration: { mode: "manual", autoPrompt: "", enabled: true },
      setScreenshotConfiguration: vi.fn(),
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
vi.mock("@/hooks/useVoiceInput", () => ({ invokeVoiceShortcutToggle: vi.fn() }));
vi.mock("./useWindow", () => ({ useWindowResize: () => ({ resizeWindow: vi.fn() }) }));
vi.mock("@/lib", () => ({
  // The real request builder (loaded below); everything else is the fake database
  fetchAIResponse: (params: unknown) => store.real.fetchAIResponse(params),
  saveConversation: vi.fn(async (c: ChatConversation) => {
    store.conversations.set(c.id, structuredClone(c));
    return c;
  }),
  getConversationById: vi.fn(async (id: string) => structuredClone(store.conversations.get(id)) ?? null),
  generateConversationTitle: (m: string) => m,
  MESSAGE_ID_OFFSET: 1,
  generateConversationId: () => `conv_${++store.ids}`,
  generateMessageId: (role: string) => `${role}_${++store.ids}`,
  generateRequestId: () => `req_${++store.ids}`,
  getResponseSettings: () => ({ autoScroll: true, responseLength: "", language: "" }),
  RESPONSE_LENGTHS: [],
  LANGUAGES: [],
}));
vi.mock("@/lib/database/attachment-data.action", () => ({
  saveAttachmentData: vi.fn(async (conversationId: string, messageId: string, files: any[]) => {
    const images = store.images.get(conversationId) ?? new Map();
    for (const f of files) {
      if (f.kind === "image" && f.base64 && !images.has(f.id)) {
        images.set(f.id, { messageId, name: f.name, data: f.base64, mimeType: f.type });
      }
    }
    store.images.set(conversationId, images);
  }),
  getAttachmentData: vi.fn(async (conversationId: string) => {
    store.loads.push(conversationId);
    return new Map(
      [...(store.images.get(conversationId) ?? [])].map(([id, r]) => [id, { data: r.data, mimeType: r.mimeType }])
    );
  }),
}));

beforeAll(async () => {
  store.real.fetchAIResponse = (
    await vi.importActual<typeof import("@/lib/functions/ai-response.function")>("@/lib/functions/ai-response.function")
  ).fetchAIResponse;
});

// ---------------------------------------------------------------- network
let fetchMock: ReturnType<typeof vi.fn>;
let nextAnswers: Array<string | "FAIL"> = [];
const answerResponse = (text: string) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  text: async () => "",
  body: {
    getReader: () => {
      const lines = [`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`, "data: [DONE]\n"];
      return {
        read: async () =>
          lines.length ? { done: false, value: new TextEncoder().encode(lines.shift()!) } : { done: true, value: undefined },
        cancel: vi.fn(),
      };
    },
  },
});
const failure = () => ({ ok: false, status: 503, statusText: "Unavailable", text: async () => "busy", json: async () => ({}) });
const requests = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
const lastRequest = () => requests()[requests().length - 1];

// ---------------------------------------------------------------- files
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const pngBytes = (seed: number) => [...PNG, seed, seed + 1, seed + 2];
const pngFile = (name: string, seed: number) =>
  Object.assign(new File([new Uint8Array(pngBytes(seed))], name, { type: "image/png" }), { seed });
/** The base64 the app reads from a test PNG (jsdom's File has no arrayBuffer). */
const base64Of = async (file: File & { seed: number }) => Buffer.from(pngBytes(file.seed)).toString("base64");

type Hook = { current: ReturnType<typeof useCompletion> };
const start = async () => {
  const hook = renderHook(() => useCompletion());
  await act(async () => {});
  return hook;
};
const attach = async (result: Hook, files: File[]) => {
  await act(async () => {
    result.current.handleFileSelect({ target: { files, value: "x" } } as any);
  });
  await waitFor(() => expect(result.current.isReadingAttachments).toBe(false));
  await waitFor(() => expect(result.current.attachedFiles).toHaveLength(files.length));
};
const ask = async (result: Hook, text: string, answer = `Answer to: ${text}`) => {
  nextAnswers.push(answer);
  act(() => result.current.setInput(text));
  await act(async () => {
    await result.current.submit();
  });
};

/** Gemini turns (contents) that carry an image, with the image data and their text. */
const imageTurns = (body: any) =>
  body.contents
    .map((turn: any, index: number) => ({ index, turn }))
    .filter(({ turn }: any) => turn.parts?.some((p: any) => p.inline_data))
    .map(({ index, turn }: any) => ({
      index,
      text: turn.parts.find((p: any) => typeof p.text === "string")?.text ?? "",
      images: turn.parts.filter((p: any) => p.inline_data).map((p: any) => p.inline_data),
    }));

let consoleCalls: unknown[][] = [];
beforeEach(() => {
  store.conversations.clear();
  store.images.clear();
  store.loads = [];
  app.provider = "gemini";
  nextAnswers = [];
  fetchMock = vi.fn(async () => {
    const next = nextAnswers.shift() ?? "ok";
    return next === "FAIL" ? failure() : answerResponse(next);
  });
  vi.stubGlobal("fetch", fetchMock);
  consoleCalls = [];
  for (const level of ["log", "warn", "error", "info", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args);
    });
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("conversation memory: messages and attachments", () => {
  it("REAL WORKFLOW: attach image → send → many messages → ask about the image → the original image is in the request", async () => {
    const { result } = await start();
    const photo = pngFile("photo.png", 1);
    const photoData = await base64Of(photo);

    await attach(result, [photo]);
    await ask(result, "Analyze this image", "A red ball on grass.");
    // Q1's own request carried the image (as before)
    expect(imageTurns(lastRequest())).toHaveLength(1);

    for (let i = 2; i <= 19; i++) await ask(result, `Unrelated question ${i}`);
    await ask(result, "What color was the object in that image?");

    const body = lastRequest();
    // 19 earlier exchanges + the new question
    expect(body.contents).toHaveLength(39);
    const turns = imageTurns(body);
    expect(turns).toHaveLength(1);
    expect(turns[0].index).toBe(0); // with Q1, where it was attached
    expect(turns[0].images).toEqual([{ mime_type: "image/png", data: photoData }]);
    expect(turns[0].text).toContain("Analyze this image");
    expect(turns[0].text).toContain('"photo.png"');
    // Q1's answer follows it, and the new question is last
    expect(body.contents[1]).toEqual({ role: "model", parts: [{ text: "A red ball on grass." }] });
    expect(body.contents[body.contents.length - 1].parts[0].text).toContain("What color was the object in that image?");
    // Kept once, scoped to this conversation and linked to Q1
    const [conversationId] = [...store.conversations.keys()];
    const kept = [...store.images.get(conversationId)!.values()];
    expect(kept).toHaveLength(1);
    expect(kept[0].messageId).toBe(store.conversations.get(conversationId)!.messages[0].id);
  });

  it("two images in different messages stay with their own messages", async () => {
    const { result } = await start();
    const photo = pngFile("photo.png", 1);
    const chart = pngFile("chart.png", 50);

    await attach(result, [photo]);
    await ask(result, "Here is a photo");
    await ask(result, "Something else");
    await attach(result, [chart]);
    await ask(result, "Here is a chart");
    await ask(result, "Compare the photo with the chart");

    const turns = imageTurns(lastRequest());
    expect(turns.map((t: any) => [t.index, t.text.includes("Here is a photo"), t.text.includes("Here is a chart")])).toEqual([
      [0, true, false],
      [4, false, true],
    ]);
    expect(turns[0].images[0].data).toBe(await base64Of(photo));
    expect(turns[1].images[0].data).toBe(await base64Of(chart));
    expect(turns[0].text).toContain('"photo.png"');
    expect(turns[1].text).toContain('"chart.png"');
  });

  it("a text/code file from Q1 is still available as text at Q20", async () => {
    const { result } = await start();
    await attach(result, [new File(["The launch code is 4217.\n"], "notes.txt", { type: "text/plain" })]);
    await ask(result, "Remember this file");
    for (let i = 2; i <= 19; i++) await ask(result, `Unrelated ${i}`);
    await ask(result, "What was the launch code in my file?");

    const first = lastRequest().contents[0].parts[0].text;
    expect(first).toContain("Attached file: notes.txt");
    expect(first).toContain("The launch code is 4217.");
  });

  it("Continue chat after a restart restores the conversation and sends its earlier image", async () => {
    const before = await start();
    const photo = pngFile("photo.png", 1);
    await attach(before.result, [photo]);
    await ask(before.result, "Analyze this image");
    const [conversationId] = [...store.conversations.keys()];
    before.unmount(); // the app restarts: in-memory state is gone, the database stays

    store.conversations.set("conv_other", { id: "conv_other", title: "other", createdAt: 1, updatedAt: 1, messages: [] });
    const { result } = await start();
    await act(async () => {
      window.dispatchEvent(new CustomEvent("conversationSelected", { detail: { id: conversationId } }));
    });
    await waitFor(() => expect(result.current.currentConversationId).toBe(conversationId));
    store.loads = [];

    await ask(result, "What was in the image?");

    expect(imageTurns(lastRequest())).toEqual([
      expect.objectContaining({ index: 0, images: [{ mime_type: "image/png", data: await base64Of(photo) }] }),
    ]);
    // Only this conversation's attachments were read, once
    expect(store.loads).toEqual([conversationId]);
    await ask(result, "And its size?");
    expect(store.loads).toEqual([conversationId]); // kept in memory after that
    expect(imageTurns(lastRequest())).toHaveLength(1);
  });

  it("New chat inherits no attachments", async () => {
    const { result } = await start();
    await attach(result, [pngFile("photo.png", 1)]);
    await ask(result, "Analyze this image");
    act(() => result.current.startNewConversation());

    await ask(result, "What was in the image?");

    const body = lastRequest();
    expect(body.contents).toHaveLength(1);
    expect(imageTurns(body)).toEqual([]);
    expect(store.conversations.size).toBe(2);
    const newId = result.current.currentConversationId!;
    expect(store.images.get(newId)?.size ?? 0).toBe(0);
  });

  it("a provider that can't read images gets none, with a note in Q1 and a notice for the user", async () => {
    const { result, rerender } = await start();
    await attach(result, [pngFile("photo.png", 1)]);
    await ask(result, "Analyze this image");

    app.provider = "groq";
    rerender();
    await ask(result, "What was in the image?");

    const body = lastRequest();
    expect(JSON.stringify(body)).not.toMatch(/image_url|inline_data|"type":"image"/);
    expect(body.messages[1].content).toContain(`Image "photo.png" was attached here but isn't included: Groq can't read images.`);
    expect(result.current.contextNotice).toBe(
      `Earlier image not sent with this message: "photo.png" (Groq can't read images).`
    );
    // Switching back sends it again: nothing was lost
    app.provider = "gemini";
    rerender();
    await ask(result, "Now describe the image");
    expect(imageTurns(lastRequest())).toHaveLength(1);
    expect(result.current.contextNotice).toBeNull();
  });

  it("a provider failure keeps the image linked; the retry sends it", async () => {
    const { result } = await start();
    const photo = pngFile("photo.png", 1);
    await attach(result, [photo]);
    await ask(result, "Analyze this image");
    const [conversationId] = [...store.conversations.keys()];
    const savedBefore = structuredClone(store.conversations.get(conversationId));

    await ask(result, "What color was it?", "FAIL");
    expect(result.current.error).toBeTruthy();
    expect(store.conversations.get(conversationId)).toEqual(savedBefore);

    await ask(result, "What color was it?");
    expect(imageTurns(lastRequest())[0].images[0].data).toBe(await base64Of(photo));
  });

  it("a follow-up never mutates stored messages or attachment records", async () => {
    const { result } = await start();
    await attach(result, [pngFile("photo.png", 1)]);
    await ask(result, "Analyze this image");
    await ask(result, "More?");
    const [conversationId] = [...store.conversations.keys()];
    const messagesBefore = structuredClone(store.conversations.get(conversationId)!.messages);
    const imagesBefore = structuredClone([...store.images.get(conversationId)!]);
    const historyBefore = structuredClone(result.current.conversationHistory);

    await ask(result, "And now?");

    expect(store.conversations.get(conversationId)!.messages.slice(0, messagesBefore.length)).toEqual(messagesBefore);
    expect([...store.images.get(conversationId)!]).toEqual(imagesBefore);
    expect(result.current.conversationHistory.slice(0, historyBefore.length)).toEqual(historyBefore);
    // Stored messages keep only the image's details; its data lives with the conversation
    expect(messagesBefore[0].attachedFiles![0].base64).toBe("");
  });

  it("never logs attachment contents or the API key", async () => {
    const { result } = await start();
    const photo = pngFile("photo.png", 1);
    await attach(result, [photo, new File(["TOP SECRET NOTE"], "secret.txt", { type: "text/plain" })]);
    await ask(result, "Analyze these");
    await ask(result, "Again?", "FAIL");
    await ask(result, "Again?");

    const logged = JSON.stringify(consoleCalls);
    expect(logged).not.toContain(await base64Of(photo));
    expect(logged).not.toContain("TOP SECRET NOTE");
    expect(logged).not.toContain(API_KEY);
  });
});
