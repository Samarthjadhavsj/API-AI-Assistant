import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { AppProvider } from "@/contexts/app.context";
import { useSettings } from "@/hooks/useSettings";
import { AIProviders } from "@/pages/dev/components/ai-configs";
import { VoiceTranscriptionSettings } from "./components/VoiceTranscriptionSettings";
import { AI_PROVIDERS } from "@/config/ai-providers.constants";
import { fetchAIResponse } from "@/lib/functions/ai-response.function";
import { createSttAdapter } from "@/lib/stt/sttAdapterFactory";

vi.mock("@tauri-apps/plugin-autostart", () => ({ enable: vi.fn(), disable: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@/lib/voice/wav", () => ({
  recordingToWav: vi.fn(async () => new Blob(["WAV"], { type: "audio/wav" })),
}));
vi.mock("@/lib", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib")>()),
  trackAppStart: vi.fn(async () => {}),
}));

beforeAll(() => {
  const proto = Element.prototype as any;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

/** A real in-memory localStorage, kept across "restarts". */
const memory = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
const saved = (key: string) => JSON.parse(memory.get(key) ?? "null");

const GEMINI = { api_key: "gemini-key-111", model: "gemini-3.5-flash-lite" };
const GEMINI_VOICE = { api_key: "voice-key-222", model: "gemini-3.5-transcribe-live" };

beforeEach(() => {
  memory.clear();
  memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: GEMINI }));
  memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "gemini-transcribe", variables: GEMINI_VOICE }));
  (globalThis as any).localStorage = memoryStorage;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const AiPage = () => <AIProviders {...useSettings()} />;
const VoicePage = () => <VoiceTranscriptionSettings {...useSettings()} />;

/** Opens a settings page in a freshly started app (everything loaded from storage). */
const launch = async (page: "ai" | "voice") => {
  const view = render(
    <AppProvider>
      <MemoryRouter>{page === "ai" ? <AiPage /> : <VoicePage />}</MemoryRouter>
    </AppProvider>
  );
  await act(async () => {});
  return view;
};

type User = ReturnType<typeof userEvent.setup>;

const region = (name: string) => screen.getByRole("region", { name });
const geminiSection = () => region("Gemini");
const otherAi = () => region("Other AI providers");
const otherVoice = () => region("Other voice providers");
const aiSummary = () => screen.getByTestId("active-ai-provider").textContent;
const voiceSummary = () => screen.getByTestId("active-voice-provider").textContent;

/** Option rows of a section's Provider dropdown: [name, note]. */
const providerOptions = async (user: User, section: HTMLElement) => {
  await user.click(within(section).getByRole("combobox", { name: "Provider" }));
  const listbox = await screen.findByRole("listbox");
  const rows = within(listbox)
    .getAllByRole("option")
    .map((o) => [
      o.querySelector(".font-medium")?.textContent,
      o.querySelector(".ml-auto")?.textContent ?? null,
    ]);
  const separator = listbox.querySelector("[data-slot=select-separator]");
  const options = within(listbox).getAllByRole("option");
  const customAfterSeparator =
    !!separator && !!(separator.compareDocumentPosition(options[options.length - 1]) & Node.DOCUMENT_POSITION_FOLLOWING);
  await user.keyboard("{Escape}");
  return { rows, customAfterSeparator };
};

const chooseProvider = async (user: User, section: HTMLElement, name: string) => {
  await user.click(within(section).getByRole("combobox", { name: "Provider" }));
  const option = within(await screen.findByRole("listbox"))
    .getAllByRole("option")
    .find((o) => o.querySelector(".font-medium")?.textContent === name);
  if (!option) throw new Error(`no provider option ${name}`);
  await user.click(option);
};

/** Replaces a field's value the way keys and model IDs are usually entered: pasted. */
const typeInto = async (user: User, field: HTMLElement, text: string) => {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
};

const status = (section: HTMLElement) => within(section).getByTestId("provider-status").textContent;

const AI_PROVIDER_NAMES = ["OpenAI", "Claude", "Grok", "Mistral", "Cohere", "Groq", "Perplexity", "OpenRouter", "Ollama", "DeepSeek"];

// Whole-app integration tests (real context and storage): allow for a busy machine.
describe("AI Providers page", { timeout: 20_000 }, () => {
  it("has a built-in Gemini section and a manual Other AI providers section, and nothing about voice", async () => {
    await launch("ai");

    expect(screen.getAllByRole("region").map((r) => within(r).getByRole("heading").textContent)).toEqual([
      "Gemini",
      "Other AI providers",
    ]);
    expect(within(geminiSection()).getByText("Built-in")).toBeInTheDocument();
    expect(within(otherAi()).getByText("Manual")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/voice|transcri|speech/i);
    expect(aiSummary()).toBe("Answering with Gemini · Gemini 3.5 Flash Lite");
  });

  it("the Gemini section shows only Gemini settings", async () => {
    await launch("ai");
    const gemini = within(geminiSection());

    expect(gemini.getByLabelText("Gemini API key")).toHaveValue(GEMINI.api_key);
    expect(gemini.getByRole("combobox", { name: "Model" })).toHaveTextContent("Gemini 3.5 Flash Lite");
    expect(gemini.getByText("In use")).toBeInTheDocument();
    expect(gemini.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument();
    expect(gemini.queryByLabelText("Model name")).not.toBeInTheDocument();
  });

  it("the Provider dropdown lists the providers in order, then Custom last below a divider, never Gemini", async () => {
    const user = userEvent.setup();
    await launch("ai");

    const { rows, customAfterSeparator } = await providerOptions(user, otherAi());

    expect(rows.map(([name]) => name)).toEqual([...AI_PROVIDER_NAMES, "Custom"]);
    expect(customAfterSeparator).toBe(true);
    expect(rows.map(([name]) => name)).not.toContain("Gemini");
    // The old Add Custom Provider card is gone
    expect(screen.queryByText("Add Custom Provider")).not.toBeInTheDocument();
  });

  it.each(AI_PROVIDER_NAMES)("selecting %s shows its name, model name, API key and status", async (name) => {
    const user = userEvent.setup();
    await launch("ai");

    await chooseProvider(user, otherAi(), name);
    const other = within(otherAi());

    expect(other.getByLabelText("Provider name")).toHaveValue(name);
    expect(other.getByLabelText("Provider name")).toHaveAttribute("readonly");
    expect(other.getByLabelText("Model name")).toHaveValue("");
    expect(other.getByLabelText(`${name} API key`)).toHaveValue("");
    expect(status(otherAi())).toBe("Model name and API key required");
    expect(other.getByRole("button", { name: `Use ${name}` })).toBeDisabled();
  });

  it("setting up a provider shows its status, and Use makes it answer through its own API", async () => {
    const user = userEvent.setup();
    await launch("ai");
    await chooseProvider(user, otherAi(), "Claude");
    const other = within(otherAi());

    await typeInto(user, other.getByLabelText("Model name"), "claude-model-x");
    expect(status(otherAi())).toBe("API key required");
    await typeInto(user, other.getByLabelText("Claude API key"), "claude-key");
    expect(status(otherAi())).toBe("Ready");
    // Configuring alone doesn't switch providers
    expect(aiSummary()).toBe("Answering with Gemini · Gemini 3.5 Flash Lite");

    await user.click(other.getByRole("button", { name: "Use Claude" }));

    expect(aiSummary()).toBe("Answering with Claude · claude-model-x");
    expect(other.getByText("In use")).toBeInTheDocument();
    expect(within(geminiSection()).getByRole("button", { name: "Use Gemini" })).toBeEnabled();

    // What a question now sends: Claude's endpoint, key and model
    const active = saved("curl_selected_ai_provider");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true }), cancel: vi.fn() }) },
    }));
    vi.stubGlobal("fetch", fetchMock);
    for await (const _ of fetchAIResponse({
      provider: AI_PROVIDERS.find((p) => p.id === active.provider),
      selectedProvider: active,
      userMessage: "hi",
    }));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("claude-key");
    expect(JSON.parse(init.body as string).model).toBe("claude-model-x");
  });

  it("switching providers never clears saved values; switching back restores them", async () => {
    const user = userEvent.setup();
    await launch("ai");

    await chooseProvider(user, otherAi(), "Claude");
    await typeInto(user, within(otherAi()).getByLabelText("Model name"), "claude-model-x");
    await typeInto(user, within(otherAi()).getByLabelText("Claude API key"), "claude-key");
    await user.click(within(otherAi()).getByRole("button", { name: "Use Claude" }));

    await chooseProvider(user, otherAi(), "OpenAI");
    await typeInto(user, within(otherAi()).getByLabelText("Model name"), "openai-model-y");
    await typeInto(user, within(otherAi()).getByLabelText("OpenAI API key"), "openai-key");
    // Choosing OpenAI to set it up didn't switch answers away from Claude
    expect(aiSummary()).toBe("Answering with Claude · claude-model-x");

    await chooseProvider(user, otherAi(), "Claude");
    expect(within(otherAi()).getByLabelText("Model name")).toHaveValue("claude-model-x");
    expect(within(otherAi()).getByLabelText("Claude API key")).toHaveValue("claude-key");

    await user.click(within(geminiSection()).getByRole("button", { name: "Use Gemini" }));
    expect(aiSummary()).toBe("Answering with Gemini · Gemini 3.5 Flash Lite");
    expect(within(geminiSection()).getByLabelText("Gemini API key")).toHaveValue(GEMINI.api_key);

    expect(saved("ai_provider_configs")).toEqual({
      gemini: GEMINI,
      claude: { model: "claude-model-x", api_key: "claude-key" },
      openai: { model: "openai-model-y", api_key: "openai-key" },
    });
  });

  it("Custom: set up an endpoint inline, then its fields; requests go through it", async () => {
    const user = userEvent.setup();
    await launch("ai");
    await chooseProvider(user, otherAi(), "Custom");
    const other = within(otherAi());

    expect(other.getByText("Save the endpoint to add its model name and API key.")).toBeInTheDocument();

    // Invalid request: explained, nothing saved
    await typeInto(user, other.getByLabelText("Request (cURL)"), "not a curl command");
    await user.click(other.getByRole("button", { name: "Save endpoint" }));
    expect(other.getByLabelText("Request (cURL)")).toHaveAttribute("aria-invalid", "true");
    expect(memory.get("curl_custom_ai_providers")).toBeUndefined();

    await typeInto(user, other.getByLabelText("Provider name"), "My LLM");
    await typeInto(
      user,
      other.getByLabelText("Request (cURL)"),
      `curl "https://llm.example.com/v1/generate" -H "Authorization: Bearer {{API_KEY}}" -H "X-Region: {{REGION}}" -d '{"model": "{{MODEL}}", "prompt": "{{TEXT}}"}'`
    );
    await typeInto(user, other.getByLabelText("Response text path"), "output.answer");
    await user.click(other.getByRole("button", { name: "Save endpoint" }));

    const customProviders = saved("curl_custom_ai_providers");
    expect(customProviders).toHaveLength(1);
    expect(customProviders[0]).toMatchObject({ name: "My LLM", responseContentPath: "output.answer", isCustom: true });

    const section = within(otherAi());
    expect(section.getByRole("combobox", { name: "Provider" })).toHaveTextContent("Custom");
    await typeInto(user, section.getByLabelText("Model name"), "my-model");
    await typeInto(user, section.getByLabelText("My LLM API key"), "my-key");
    expect(status(otherAi())).toBe("Region required");
    await typeInto(user, section.getByLabelText("Region"), "eu");
    expect(status(otherAi())).toBe("Ready");

    await user.click(section.getByRole("button", { name: "Use My LLM" }));
    expect(aiSummary()).toBe("Answering with My LLM · my-model");
    expect(section.getByRole("button", { name: "Delete…" })).toBeDisabled();

    // What a question now sends: the custom endpoint, with its fields
    const active = saved("curl_selected_ai_provider");
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ output: { answer: "ok" } }) }));
    vi.stubGlobal("fetch", fetchMock);
    const chunks: string[] = [];
    for await (const chunk of fetchAIResponse({
      provider: { ...saved("curl_custom_ai_providers")[0] },
      selectedProvider: active,
      userMessage: "What is 2+2?",
    })) {
      chunks.push(chunk);
    }
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://llm.example.com/v1/generate");
    expect(init.headers.Authorization).toBe("Bearer my-key");
    expect(init.headers["X-Region"]).toBe("eu");
    expect(JSON.parse(init.body as string)).toEqual({ model: "my-model", prompt: "What is 2+2?" });
    expect(chunks).toEqual(["ok"]);
  });

  it("deleting a custom endpoint also removes its saved key; other providers keep theirs", async () => {
    const CLAUDE = { api_key: "claude-key", model: "claude-model-x" };
    const CUSTOM = { api_key: "custom-secret-key", model: "my-model" };
    memory.set(
      "curl_custom_ai_providers",
      JSON.stringify([
        {
          id: "custom-1",
          isCustom: true,
          name: "My LLM",
          curl: `curl "https://llm.example.com/v1/generate" -H "Authorization: Bearer {{API_KEY}}" -d '{"model": "{{MODEL}}", "prompt": "{{TEXT}}"}'`,
          responseContentPath: "output.answer",
          streaming: false,
        },
      ])
    );
    memory.set("ai_provider_configs", JSON.stringify({ gemini: GEMINI, claude: CLAUDE, "custom-1": CUSTOM }));
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "custom-1", variables: CUSTOM }));
    memory.set("ai_other_provider", "custom-1");
    const user = userEvent.setup();
    await launch("ai");
    const section = within(otherAi());

    // In use: still can't be deleted, and its key is kept
    expect(aiSummary()).toBe("Answering with My LLM · my-model");
    expect(section.getByRole("button", { name: "Delete…" })).toBeDisabled();
    await user.click(section.getByRole("button", { name: "Delete…" }));
    expect(section.queryByRole("button", { name: "Delete endpoint" })).not.toBeInTheDocument();
    expect(saved("ai_provider_configs")["custom-1"]).toEqual(CUSTOM);

    await user.click(within(geminiSection()).getByRole("button", { name: "Use Gemini" }));
    await user.click(section.getByRole("button", { name: "Delete…" }));
    await user.click(section.getByRole("button", { name: "Delete endpoint" }));

    expect(saved("curl_custom_ai_providers")).toEqual([]);
    expect(saved("ai_provider_configs")).toEqual({ gemini: GEMINI, claude: CLAUDE });
    expect(memory.get("ai_provider_configs")).not.toContain(CUSTOM.api_key);
    expect(saved("curl_selected_ai_provider")).toEqual({ provider: "gemini", variables: GEMINI });
  });

  it("says so when Gemini is in use without a key or model", async () => {
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: {} }));
    await launch("ai");
    const gemini = within(geminiSection());

    expect(gemini.getByText("In use")).toBeInTheDocument();
    expect(gemini.getByRole("status")).toHaveTextContent("Gemini is in use but can't answer yet. Add an API key and a model.");
  });

  it("restart restores the provider in use, the chosen provider and every provider's values", async () => {
    const user = userEvent.setup();
    const first = await launch("ai");
    await chooseProvider(user, otherAi(), "Groq");
    await typeInto(user, within(otherAi()).getByLabelText("Model name"), "groq-model");
    await typeInto(user, within(otherAi()).getByLabelText("Groq API key"), "groq-key");
    await user.click(within(otherAi()).getByRole("button", { name: "Use Groq" }));
    first.unmount();

    await launch("ai");

    expect(aiSummary()).toBe("Answering with Groq · groq-model");
    expect(within(otherAi()).getByRole("combobox", { name: "Provider" })).toHaveTextContent("Groq");
    expect(within(otherAi()).getByLabelText("Groq API key")).toHaveValue("groq-key");
    expect(within(geminiSection()).getByLabelText("Gemini API key")).toHaveValue(GEMINI.api_key);
  });
});

describe("Voice Transcription page", { timeout: 20_000 }, () => {
  it("has a built-in Gemini Voice section and a manual Other voice providers section, and nothing about AI Response", async () => {
    await launch("voice");

    expect(screen.getAllByRole("region").map((r) => within(r).getByRole("heading").textContent)).toEqual([
      "Gemini Voice",
      "Other voice providers",
    ]);
    expect(voiceSummary()).toBe("Transcribing with Gemini Voice · Gemini 3.5 Transcribe Live");
    expect(document.body.textContent).not.toMatch(/AI Response|Answering with|requests\/day/);
    expect(within(region("Gemini Voice")).getByLabelText("Gemini API key")).toHaveValue(GEMINI_VOICE.api_key);
  });

  it("the voice Provider dropdown: same order, Custom last, and providers without speech-to-text marked", async () => {
    const user = userEvent.setup();
    await launch("voice");

    const { rows, customAfterSeparator } = await providerOptions(user, otherVoice());

    expect(rows).toEqual([
      ["OpenAI", null],
      ["Claude", "No speech-to-text"],
      ["Grok", null],
      ["Mistral", null],
      ["Cohere", null],
      ["Groq", null],
      ["Perplexity", "No speech-to-text"],
      ["OpenRouter", null],
      ["Ollama", "No speech-to-text"],
      ["DeepSeek", "No speech-to-text"],
      ["Custom", "Your own endpoint"],
    ]);
    expect(customAfterSeparator).toBe(true);
    expect(rows.map(([name]) => name)).not.toContain("Gemini Voice");
  });

  it("a provider without speech-to-text says so and can't be used", async () => {
    const user = userEvent.setup();
    await launch("voice");

    await chooseProvider(user, otherVoice(), "Claude");
    const other = within(otherVoice());

    expect(other.getByRole("note")).toHaveTextContent(
      "Claude's API doesn't accept audio, so it can't transcribe speech. Choose another provider for voice input."
    );
    expect(status(otherVoice())).toBe("No speech-to-text");
    expect(other.queryByRole("button", { name: /^Use / })).not.toBeInTheDocument();
    expect(voiceSummary()).toBe("Transcribing with Gemini Voice · Gemini 3.5 Transcribe Live");
  });

  it("a supported provider can be set up and used; voice input then transcribes with it", async () => {
    const user = userEvent.setup();
    await launch("voice");

    await chooseProvider(user, otherVoice(), "OpenAI");
    const other = within(otherVoice());
    expect(other.getByLabelText("Provider name")).toHaveValue("OpenAI");
    expect(status(otherVoice())).toBe("Model name and API key required");
    await typeInto(user, other.getByLabelText("Model name"), "gpt-transcribe");
    await typeInto(user, other.getByLabelText("OpenAI API key"), "sk-voice");
    expect(status(otherVoice())).toBe("Ready");

    await user.click(other.getByRole("button", { name: "Use OpenAI" }));
    expect(voiceSummary()).toBe("Transcribing with OpenAI · gpt-transcribe");
    expect(within(region("Gemini Voice")).getByRole("button", { name: "Use Gemini Voice" })).toBeEnabled();

    // What voice input now does: upload to OpenAI with the saved model and key
    const active = saved("curl_selected_stt_provider");
    expect(active).toEqual({ provider: "openai", variables: { model: "gpt-transcribe", api_key: "sk-voice" } });
    vi.mocked(tauriFetch).mockResolvedValue({ ok: true, status: 200, text: async () => '{"text":"hello"}' } as any);
    const adapter = createSttAdapter({ id: active.provider, curl: "" }, active)!;
    const result = await adapter.transcribe(
      { blob: new Blob(["x"], { type: "audio/webm" }), mimeType: "audio/webm", durationMs: 1, sizeBytes: 1, deviceId: null, chunkCount: 1 },
      { signal: new AbortController().signal }
    );
    expect(result.text).toBe("hello");
    const [url, init] = vi.mocked(tauriFetch).mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers.Authorization).toBe("Bearer sk-voice");
    expect((init.body as FormData).get("model")).toBe("gpt-transcribe");
  });

  it("Cohere asks for the language it needs", async () => {
    const user = userEvent.setup();
    await launch("voice");
    await chooseProvider(user, otherVoice(), "Cohere");
    const other = within(otherVoice());

    await typeInto(user, other.getByLabelText("Model name"), "cohere-transcribe-03-2026");
    await typeInto(user, other.getByLabelText("Cohere API key"), "co-key");
    expect(status(otherVoice())).toBe("Language required");
    await typeInto(user, other.getByLabelText("Language"), "en");
    expect(status(otherVoice())).toBe("Ready");
  });

  it("Custom: provider name, endpoint, model and optional key", async () => {
    const user = userEvent.setup();
    await launch("voice");
    await chooseProvider(user, otherVoice(), "Custom");
    const other = within(otherVoice());

    expect(status(otherVoice())).toBe("Endpoint URL and Model name required");
    await typeInto(user, other.getByLabelText("Provider name"), "My Whisper");
    await typeInto(user, other.getByLabelText("Endpoint URL"), "http://localhost:9000/v1/audio/transcriptions");
    await typeInto(user, other.getByLabelText("Model name"), "small.en");
    expect(other.getByLabelText("API key (optional)")).toHaveValue("");
    expect(status(otherVoice())).toBe("Ready");

    await user.click(other.getByRole("button", { name: "Use My Whisper" }));
    expect(voiceSummary()).toBe("Transcribing with My Whisper · small.en");
    expect(saved("voice_provider_configs").custom).toEqual({
      name: "My Whisper",
      endpoint: "http://localhost:9000/v1/audio/transcriptions",
      model: "small.en",
    });
  });

  it("switching back to Gemini Voice restores it; nothing is lost; AI settings are untouched; restart keeps it all", async () => {
    const user = userEvent.setup();
    const first = await launch("voice");
    await chooseProvider(user, otherVoice(), "Groq");
    await typeInto(user, within(otherVoice()).getByLabelText("Model name"), "whisper-large-v3-turbo");
    await typeInto(user, within(otherVoice()).getByLabelText("Groq API key"), "gq-key");
    await user.click(within(otherVoice()).getByRole("button", { name: "Use Groq" }));
    expect(voiceSummary()).toBe("Transcribing with Groq · whisper-large-v3-turbo");

    await user.click(within(region("Gemini Voice")).getByRole("button", { name: "Use Gemini Voice" }));
    expect(voiceSummary()).toBe("Transcribing with Gemini Voice · Gemini 3.5 Transcribe Live");
    expect(saved("curl_selected_stt_provider")).toEqual({ provider: "gemini-transcribe", variables: GEMINI_VOICE });
    expect(saved("voice_provider_configs").groq).toEqual({ model: "whisper-large-v3-turbo", api_key: "gq-key" });
    expect(saved("curl_selected_ai_provider")).toEqual({ provider: "gemini", variables: GEMINI });

    await user.click(within(otherVoice()).getByRole("button", { name: "Use Groq" }));
    first.unmount();

    await launch("voice");
    expect(voiceSummary()).toBe("Transcribing with Groq · whisper-large-v3-turbo");
    expect(within(otherVoice()).getByRole("combobox", { name: "Provider" })).toHaveTextContent("Groq");
    expect(within(otherVoice()).getByLabelText("Groq API key")).toHaveValue("gq-key");
    expect(within(region("Gemini Voice")).getByLabelText("Gemini API key")).toHaveValue(GEMINI_VOICE.api_key);
  });
});
