import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatConversation } from "@/types/completion";
import { STORAGE_KEYS } from "@/config";
import { useCompletion } from "@/hooks/useCompletion";
import { Input } from "./Input";

/**
 * Translate & Send, end to end: the real useCompletion + Input + VoiceInputBar,
 * the real translateText, and the real fetchAIResponse with the Gemini
 * template. The microphone, network and database are fakes; the voice fake
 * counts recordings and transcriptions.
 */
const AI_KEY = "ai-response-key-secret";
const VOICE_KEY = "voice-gemini-key-secret";

const voice = vi.hoisted(() => ({
  state: "idle",
  transcript: "",
  start: null as any,
  stop: null as any,
  cancel: null as any,
}));
const store = vi.hoisted(() => ({
  conversations: new Map<string, ChatConversation>(),
  images: new Map<string, Map<string, { data: string; mimeType: string }>>(),
  ids: 0,
  real: { fetchAIResponse: null as any },
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@/hooks/useWindow", () => ({
  EXPANDED_WINDOW_HEIGHT: 600,
  isAnyPopoverOpen: () => false,
  setNativeWindowHeight: vi.fn(),
  useWindowResize: () => ({ resizeWindow: vi.fn() }),
}));
vi.mock("@/hooks/useVoiceInput", () => ({
  invokeVoiceShortcutToggle: vi.fn(),
  useVoiceInput: () => voice,
}));
vi.mock("@/contexts", async () => {
  const { AI_PROVIDERS } = await vi.importActual<typeof import("@/config/ai-providers.constants")>(
    "@/config/ai-providers.constants"
  );
  const { GEMINI_TRANSCRIBE_PROVIDER_ID } = await vi.importActual<typeof import("@/config/stt.constants")>(
    "@/config/stt.constants"
  );
  return {
    useApp: () => ({
      selectedAIProvider: { provider: "gemini", variables: { api_key: AI_KEY, model: "ai-model" } },
      allAiProviders: AI_PROVIDERS,
      systemPrompt: "",
      screenshotConfiguration: { mode: "manual", autoPrompt: "", enabled: true },
      setScreenshotConfiguration: vi.fn(),
      selectedAudioDevices: {},
      selectedSttProvider: {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: { api_key: VOICE_KEY, model: "gemini-3.5-transcribe-live" },
      },
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
vi.mock("@/lib", () => ({
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
  saveAttachmentData: vi.fn(async (conversationId: string, _messageId: string, files: any[]) => {
    const images = store.images.get(conversationId) ?? new Map();
    for (const f of files) if (f.kind === "image" && f.base64) images.set(f.id, { data: f.base64, mimeType: f.type });
    store.images.set(conversationId, images);
  }),
  getAttachmentData: vi.fn(async (conversationId: string) => new Map(store.images.get(conversationId) ?? [])),
}));
vi.mock("@/components", async () => {
  const popover = await vi.importActual<typeof import("@/components/ui/popover")>("@/components/ui/popover");
  return {
    ...popover,
    Button: ({ children, variant: _v, size: _s, ...props }: any) => <button {...props}>{children}</button>,
    ScrollArea: ({ children, className, ref }: any) => (
      <div className={className} ref={ref}>
        <div data-radix-scroll-area-viewport="">{children}</div>
      </div>
    ),
    Markdown: ({ children }: any) => <span>{children}</span>,
    Switch: () => null,
    CopyButton: () => null,
  };
});

beforeAll(async () => {
  store.real.fetchAIResponse = (
    await vi.importActual<typeof import("@/lib/functions/ai-response.function")>("@/lib/functions/ai-response.function")
  ).fetchAIResponse;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
  HTMLElement.prototype.scrollTo = function () {} as any;
});

// ---------------------------------------------------------------- network
type Reply = string | "FAIL" | Promise<string>;
let translations: Reply[] = [];
let answers: Reply[] = [];
let fetchMock: ReturnType<typeof vi.fn>;
const isTranslation = (url: string) => url.includes("models/gemini-3.5-flash-lite:generateContent");
const geminiReply = async (reply: Reply) => {
  const text = await reply;
  return text === "FAIL"
    ? { ok: false, status: 503, statusText: "Unavailable", text: async () => "busy", json: async () => ({}) }
    : { ok: true, status: 200, statusText: "OK", json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
};
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init, body: JSON.parse(init.body) }));
const translationCalls = () => calls().filter((c) => isTranslation(c.url));
const aiCalls = () => calls().filter((c) => !isTranslation(c.url));
const lastUserText = (body: any) => body.contents[body.contents.length - 1].parts[0].text as string;

// ---------------------------------------------------------------- app
const Chat = () => {
  const completion = useCompletion();
  return (
    <>
      <output data-testid="answer">{completion.response}</output>
      <output data-testid="error">{completion.error ?? ""}</output>
      <output data-testid="draft">{completion.input}</output>
      <output data-testid="attachments">{completion.attachedFiles.map((f) => f.name).join(",")}</output>
      <Input
        {...completion}
        isHidden={false}
        trailingControls={<input aria-label="Attach files" onChange={completion.handleFileSelect} type="file" />}
      />
    </>
  );
};

type User = ReturnType<typeof userEvent.setup>;
const mic = () => screen.getByRole("button", { name: "Start voice input" });
const translateButton = () => screen.getByRole("button", { name: "Translate and send" });
const savedConversation = () => [...store.conversations.values()][0];
const speak = async (user: User, transcript: string) => {
  voice.transcript = transcript;
  await user.click(mic());
  await screen.findByRole("button", { name: "Translate and send" });
};
const typeAndSend = async (user: User, text: string, answer: string) => {
  answers.push(answer);
  await user.type(screen.getByRole("textbox"), `${text}{Enter}`);
  await waitFor(() => expect(screen.getByTestId("answer")).toHaveTextContent(answer));
};

let logged: unknown[][] = [];
beforeEach(() => {
  store.conversations.clear();
  store.images.clear();
  translations = [];
  answers = [];
  Object.assign(voice, {
    state: "idle",
    transcript: "",
    start: vi.fn(async () => {
      voice.state = "recording";
      return true;
    }),
    stop: vi.fn(async () => {
      voice.state = "idle";
      return { text: voice.transcript };
    }),
    cancel: vi.fn(() => {
      voice.state = "idle";
    }),
  });
  fetchMock = vi.fn(async (url: string) =>
    geminiReply(isTranslation(String(url)) ? translations.shift() ?? "FAIL" : answers.shift() ?? "ok")
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(localStorage.getItem).mockImplementation(() => null);
  logged = [];
  for (const level of ["log", "warn", "error", "info", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Translate & Send, end to end", () => {
  it("reuses the final transcript once, translates it with ONE Flash Lite request, and sends the translation as ONE message", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    translations.push("What's the weather like in Madrid?");
    answers.push("Sunny and 24 °C.");

    await speak(user, "¿Qué tiempo hace en Madrid?");
    await user.click(translateButton());
    await waitFor(() => expect(screen.getByTestId("answer")).toHaveTextContent("Sunny and 24 °C."));

    // One recording, one transcription, no second voice session
    expect(voice.start).toHaveBeenCalledOnce();
    expect(voice.stop).toHaveBeenCalledOnce();
    // One translation request, before the one AI request
    expect(calls().map((c) => (isTranslation(c.url) ? "translate" : "ai"))).toEqual(["translate", "ai"]);
    const [translation] = translationCalls();
    expect(translation.body.contents).toEqual([{ role: "user", parts: [{ text: "¿Qué tiempo hace en Madrid?" }] }]);
    expect(translation.init.headers["x-goog-api-key"]).toBe(VOICE_KEY); // the voice key
    expect(translation.body.systemInstruction.parts[0].text).toContain("into English"); // default language
    // The AI gets the translation, with its own provider key and model
    const [ai] = aiCalls();
    expect(ai.url).toContain("models/ai-model:generateContent");
    expect(ai.init.headers["x-goog-api-key"]).toBe(AI_KEY);
    expect(lastUserText(ai.body)).toContain("What's the weather like in Madrid?");
    expect(JSON.stringify(ai.body)).not.toContain("Qué tiempo");
    // Exactly one user message, holding the translation
    expect(savedConversation().messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "What's the weather like in Madrid?"],
      ["assistant", "Sunny and 24 °C."],
    ]);
    // Back to the normal composer, nothing left behind
    expect(screen.getByTestId("draft")).toHaveTextContent("");
    expect(mic()).toBeInTheDocument();
  });

  it("translates into the configured Responses language", async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
      key === STORAGE_KEYS.RESPONSE_SETTINGS ? JSON.stringify({ language: "spanish" }) : null
    );
    const user = userEvent.setup();
    render(<Chat />);
    translations.push("¿Qué hora es?");

    await speak(user, "What time is it?");
    await user.click(translateButton());
    await waitFor(() => expect(aiCalls()).toHaveLength(1));

    expect(translationCalls()[0].body.systemInstruction.parts[0].text).toMatch(/^Translate the user's text into Spanish\./);
    expect(lastUserText(aiCalls()[0].body)).toContain("¿Qué hora es?");
  });

  it("keeps the attachments and the conversation memory (earlier image) with the translated message", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 7])], "chart.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Attach files"), png);
    await waitFor(() => expect(screen.getByTestId("attachments")).toHaveTextContent("chart.png"));
    await typeAndSend(user, "Look at this chart", "It shows growth.");

    await user.upload(screen.getByLabelText("Attach files"), new File(["Q3 revenue: 42"], "notes.txt", { type: "text/plain" }));
    await waitFor(() => expect(screen.getByTestId("attachments")).toHaveTextContent("notes.txt"));
    translations.push("Compare the chart with my notes.");
    answers.push("Both show growth.");
    await speak(user, "Compara el gráfico con mis notas.");
    await user.click(translateButton());
    await waitFor(() => expect(screen.getByTestId("answer")).toHaveTextContent("Both show growth."));

    const body = aiCalls()[1].body;
    // Memory: the earlier image still goes with its own earlier message
    expect(JSON.stringify(body.contents[0])).toContain("inline_data");
    // This message: the translation, with the attached file
    const current = lastUserText(body);
    expect(current).toContain("Attached file: notes.txt");
    expect(current).toContain("Q3 revenue: 42");
    expect(current).toContain("Compare the chart with my notes.");
    const messages = savedConversation().messages;
    expect(messages).toHaveLength(4);
    expect(messages[2].content).toBe("Compare the chart with my notes.");
    expect(messages[2].attachedFiles!.map((f) => f.name)).toEqual(["notes.txt"]);
  });

  it("sends the draft with the translation, as one message", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    await user.type(screen.getByRole("textbox"), "Context:");
    translations.push("is it raining?");

    await speak(user, "¿está lloviendo?");
    await user.click(translateButton());
    await waitFor(() => expect(aiCalls()).toHaveLength(1));

    expect(lastUserText(aiCalls()[0].body)).toContain("Context: is it raining?");
  });

  it("translation failure: nothing is sent, the transcript stays to retry, and the retry sends", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    await user.upload(screen.getByLabelText("Attach files"), new File(["notes"], "notes.txt", { type: "text/plain" }));
    await waitFor(() => expect(screen.getByTestId("attachments")).toHaveTextContent("notes.txt"));
    translations.push("FAIL");

    await speak(user, "¿Qué tiempo hace?");
    await user.click(translateButton());

    await screen.findByText("Not translated");
    expect(aiCalls()).toHaveLength(0);
    expect(screen.getByRole("textbox")).toHaveValue("¿Qué tiempo hace?");
    expect(screen.getByTestId("draft")).toHaveTextContent(""); // never put into the composer
    expect(screen.getByTestId("attachments")).toHaveTextContent("notes.txt");
    expect(store.conversations.size).toBe(0);

    translations.push("What's the weather like?");
    answers.push("Cloudy.");
    await user.click(translateButton());
    await waitFor(() => expect(screen.getByTestId("answer")).toHaveTextContent("Cloudy."));

    expect(voice.stop).toHaveBeenCalledOnce(); // no second recording/transcription
    expect(translationCalls()).toHaveLength(2);
    expect(translationCalls()[1].body.contents[0].parts[0].text).toBe("¿Qué tiempo hace?");
    expect(savedConversation().messages.map((m) => m.content)).toEqual(["What's the weather like?", "Cloudy."]);
  });

  it("translation failure: ✓ inserts the untranslated transcript instead, ✕ discards it", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    translations.push("FAIL", "FAIL");

    await speak(user, "Hola");
    await user.click(translateButton());
    await screen.findByText("Not translated");
    await user.click(screen.getByRole("button", { name: "Finish dictation" }));
    expect(screen.getByTestId("draft")).toHaveTextContent("Hola");

    await user.clear(screen.getByRole("textbox"));
    await speak(user, "Adiós");
    await user.click(translateButton());
    await screen.findByText("Not translated");
    await user.click(screen.getByRole("button", { name: "Cancel dictation" }));
    expect(screen.getByTestId("draft")).toHaveTextContent("");
    expect(aiCalls()).toHaveLength(0);
  });

  it("AI failure after translation: the translated text and attachments stay for a retry", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    await user.upload(screen.getByLabelText("Attach files"), new File(["notes"], "notes.txt", { type: "text/plain" }));
    await waitFor(() => expect(screen.getByTestId("attachments")).toHaveTextContent("notes.txt"));
    translations.push("What's the weather like?");
    answers.push("FAIL");

    await speak(user, "¿Qué tiempo hace?");
    await user.click(translateButton());
    await waitFor(() => expect(screen.getByTestId("error")).not.toHaveTextContent(/^$/));

    expect(screen.getByTestId("draft")).toHaveTextContent("What's the weather like?");
    expect(screen.getByTestId("attachments")).toHaveTextContent("notes.txt");
    expect(store.conversations.size).toBe(0);

    answers.push("Cloudy.");
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByTestId("answer")).toHaveTextContent("Cloudy."));
    expect(translationCalls()).toHaveLength(1); // the translation is reused, not redone
    expect(savedConversation().messages.map((m) => m.content)).toEqual(["What's the weather like?", "Cloudy."]);
  });

  it("duplicate clicks while translating send one request and one message", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    let finish!: (text: string) => void;
    translations.push(new Promise<string>((resolve) => (finish = resolve)));

    await speak(user, "Hola");
    await user.click(translateButton());
    await screen.findByText("Translating…");
    expect(translateButton()).toBeDisabled();
    await user.click(translateButton());
    act(() => {
      translateButton().click();
    });
    await user.keyboard("{Enter}");
    await act(async () => finish("Hello"));
    await waitFor(() => expect(aiCalls()).toHaveLength(1));

    expect(voice.stop).toHaveBeenCalledOnce();
    expect(translationCalls()).toHaveLength(1);
    await waitFor(() => expect(savedConversation().messages.filter((m) => m.role === "user")).toHaveLength(1));
  });

  it("Cancel and Confirm are unchanged (no translation, no send)", async () => {
    const user = userEvent.setup();
    render(<Chat />);

    await speak(user, "discard me");
    await user.click(screen.getByRole("button", { name: "Cancel dictation" }));
    expect(voice.cancel).toHaveBeenCalledOnce();
    expect(screen.getByTestId("draft")).toHaveTextContent("");

    await speak(user, "keep me");
    await user.click(screen.getByRole("button", { name: "Finish dictation" }));
    await waitFor(() => expect(screen.getByTestId("draft")).toHaveTextContent("keep me"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never logs API keys or the transcript", async () => {
    const user = userEvent.setup();
    render(<Chat />);
    translations.push("FAIL", "Hello there");
    answers.push("FAIL", "Hi");

    await speak(user, "Hola, mi contraseña secreta");
    await user.click(translateButton());
    await screen.findByText("Not translated");
    await user.click(translateButton());
    await waitFor(() => expect(screen.getByTestId("error")).not.toHaveTextContent(/^$/));

    const text = JSON.stringify(logged);
    expect(text).not.toContain(AI_KEY);
    expect(text).not.toContain(VOICE_KEY);
    expect(text).not.toContain("contraseña");
  });
});
