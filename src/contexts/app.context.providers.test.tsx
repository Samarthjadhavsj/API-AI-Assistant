import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "./app.context";
import type { IContextType } from "@/types";

vi.mock("@tauri-apps/plugin-autostart", () => ({ enable: vi.fn(), disable: vi.fn() }));
vi.mock("@/lib", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib")>()),
  trackAppStart: vi.fn(async () => {}),
}));

/** A real in-memory localStorage (the global test setup stubs it out). */
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

let app: IContextType;
const Capture = () => {
  app = useApp();
  return null;
};

/** Starts the app (again): the context loads everything from storage. */
const launch = async () => {
  const view = render(
    <AppProvider>
      <Capture />
    </AppProvider>
  );
  await act(async () => {});
  return view;
};

const saved = (key: string) => JSON.parse(memory.get(key) ?? "null");

const GEMINI = { api_key: "gemini-key", model: "gemini-3.5-flash-lite" };
const CLAUDE = { api_key: "claude-key", model: "claude-model-x" };
const OPENAI = { api_key: "openai-key", model: "openai-model-y" };

beforeEach(() => {
  memory.clear();
  (globalThis as any).localStorage = memoryStorage;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("AI provider settings", () => {
  it("carries over an existing install that only saved the active provider", async () => {
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: GEMINI }));

    await launch();

    expect(app.selectedAIProvider).toEqual({ provider: "gemini", variables: GEMINI });
    expect(app.aiProviderConfigs).toEqual({ gemini: GEMINI });
    expect(app.otherAiProviderId).toBe("");
  });

  it("configuring another provider doesn't change the active provider or Gemini", async () => {
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: GEMINI }));
    await launch();

    act(() => {
      app.setOtherAiProvider("claude");
      app.updateAiProviderConfig("claude", CLAUDE);
    });

    expect(app.selectedAIProvider).toEqual({ provider: "gemini", variables: GEMINI });
    expect(app.aiProviderConfigs).toEqual({ gemini: GEMINI, claude: CLAUDE });
    expect(saved("curl_selected_ai_provider")).toEqual({ provider: "gemini", variables: GEMINI });
  });

  it("switching providers never erases saved values, and switching back restores them", async () => {
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: GEMINI }));
    await launch();
    act(() => {
      app.updateAiProviderConfig("claude", CLAUDE);
      app.updateAiProviderConfig("openai", OPENAI);
    });

    act(() => app.activateAiProvider("claude"));
    expect(app.selectedAIProvider).toEqual({ provider: "claude", variables: CLAUDE });
    expect(saved("curl_selected_ai_provider")).toEqual({ provider: "claude", variables: CLAUDE });

    act(() => app.activateAiProvider("openai"));
    expect(app.selectedAIProvider).toEqual({ provider: "openai", variables: OPENAI });

    act(() => app.activateAiProvider("gemini"));
    expect(app.selectedAIProvider).toEqual({ provider: "gemini", variables: GEMINI });

    act(() => app.activateAiProvider("claude"));
    expect(app.selectedAIProvider).toEqual({ provider: "claude", variables: CLAUDE });
    expect(app.aiProviderConfigs).toEqual({ gemini: GEMINI, claude: CLAUDE, openai: OPENAI });
  });

  it("editing the active provider updates what requests use; editing another doesn't", async () => {
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "claude", variables: CLAUDE }));
    await launch();

    act(() => app.updateAiProviderConfig("claude", { ...CLAUDE, model: "claude-model-z" }));
    expect(app.selectedAIProvider.variables.model).toBe("claude-model-z");

    act(() => app.updateAiProviderConfig("gemini", GEMINI));
    expect(app.selectedAIProvider).toEqual({ provider: "claude", variables: { ...CLAUDE, model: "claude-model-z" } });
  });

  it("the older setter still records the provider's settings", async () => {
    await launch();

    act(() => app.onSetSelectedAIProvider({ provider: "groq", variables: { api_key: "g", model: "m" } }));
    act(() => app.activateAiProvider("gemini"));
    act(() => app.activateAiProvider("groq"));

    expect(app.selectedAIProvider).toEqual({ provider: "groq", variables: { api_key: "g", model: "m" } });
    expect(app.otherAiProviderId).toBe("groq");
  });

  it("restart preserves every provider's values, the active one and the chosen other provider", async () => {
    const first = await launch();
    act(() => {
      app.updateAiProviderConfig("gemini", GEMINI);
      app.updateAiProviderConfig("claude", CLAUDE);
      app.updateAiProviderConfig("openai", OPENAI);
      app.setOtherAiProvider("openai");
    });
    act(() => app.activateAiProvider("claude"));
    act(() => app.setOtherAiProvider("openai"));
    first.unmount();

    await launch();

    expect(app.selectedAIProvider).toEqual({ provider: "claude", variables: CLAUDE });
    expect(app.aiProviderConfigs).toEqual({ gemini: GEMINI, claude: CLAUDE, openai: OPENAI });
    expect(app.otherAiProviderId).toBe("openai");
  });

  it("ignores unknown provider IDs", async () => {
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: GEMINI }));
    await launch();

    act(() => {
      app.updateAiProviderConfig("not-a-provider", { api_key: "x" });
      app.activateAiProvider("not-a-provider");
    });

    expect(app.selectedAIProvider.provider).toBe("gemini");
    expect(app.aiProviderConfigs).toEqual({ gemini: GEMINI });
  });
});

describe("Voice settings", () => {
  const GEMINI_VOICE = { api_key: "voice-key", model: "gemini-3.8-live" };
  const OPENAI_VOICE = { api_key: "sk-voice", model: "gpt-transcribe" };
  const GROQ_VOICE = { api_key: "gq-voice", model: "whisper-large-v3-turbo" };

  it("configuring another voice provider doesn't change the one in use or Gemini Voice", async () => {
    memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "gemini-transcribe", variables: GEMINI_VOICE }));
    await launch();

    act(() => {
      app.setOtherVoiceProvider("openai");
      app.updateVoiceProviderConfig("openai", OPENAI_VOICE);
    });

    expect(app.selectedSttProvider).toEqual({ provider: "gemini-transcribe", variables: GEMINI_VOICE });
    expect(app.voiceProviderConfigs).toEqual({ "gemini-transcribe": GEMINI_VOICE, openai: OPENAI_VOICE });
    expect(app.otherVoiceProviderId).toBe("openai");
    expect(memory.get("voice_other_provider")).toBe("openai");
  });

  it("switching voice providers never erases saved values, and switching back restores them", async () => {
    memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "gemini-transcribe", variables: GEMINI_VOICE }));
    await launch();
    act(() => {
      app.updateVoiceProviderConfig("openai", OPENAI_VOICE);
      app.updateVoiceProviderConfig("groq", GROQ_VOICE);
    });

    act(() => app.activateVoiceProvider("openai"));
    expect(app.selectedSttProvider).toEqual({ provider: "openai", variables: OPENAI_VOICE });
    expect(saved("curl_selected_stt_provider")).toEqual({ provider: "openai", variables: OPENAI_VOICE });

    act(() => app.activateVoiceProvider("groq"));
    act(() => app.activateVoiceProvider("gemini-transcribe"));
    expect(app.selectedSttProvider).toEqual({ provider: "gemini-transcribe", variables: GEMINI_VOICE });

    act(() => app.activateVoiceProvider("openai"));
    expect(app.selectedSttProvider).toEqual({ provider: "openai", variables: OPENAI_VOICE });
    expect(app.voiceProviderConfigs).toEqual({
      "gemini-transcribe": GEMINI_VOICE,
      openai: OPENAI_VOICE,
      groq: GROQ_VOICE,
    });
  });

  it("voice input can find the provider in use", async () => {
    await launch();
    act(() => app.updateVoiceProviderConfig("custom", { endpoint: "http://localhost:9000/v1/audio/transcriptions", model: "small" }));
    act(() => app.activateVoiceProvider("custom"));

    expect(app.allSttProviders.find((p) => p.id === app.selectedSttProvider.provider)?.id).toBe("custom");
    expect(app.allSttProviders.map((p) => p.id)).toEqual([
      "gemini-transcribe", "openai", "claude", "grok", "mistral", "cohere", "groq", "perplexity", "openrouter", "ollama", "deepseek", "custom",
    ]);
  });

  it("voice changes never touch AI settings, and AI changes never touch voice", async () => {
    memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: GEMINI }));
    memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "gemini-transcribe", variables: GEMINI_VOICE }));
    await launch();

    act(() => app.updateVoiceProviderConfig("openai", OPENAI_VOICE));
    act(() => app.activateVoiceProvider("openai"));
    expect(app.selectedAIProvider).toEqual({ provider: "gemini", variables: GEMINI });
    expect(app.aiProviderConfigs).toEqual({ gemini: GEMINI });

    act(() => app.updateAiProviderConfig("openai", { api_key: "sk-ai", model: "chat-model" }));
    act(() => app.activateAiProvider("openai"));
    expect(app.selectedSttProvider).toEqual({ provider: "openai", variables: OPENAI_VOICE });
    expect(app.voiceProviderConfigs.openai).toEqual(OPENAI_VOICE);
    expect(app.aiProviderConfigs.openai).toEqual({ api_key: "sk-ai", model: "chat-model" });
  });

  it("restart preserves the voice provider in use and every voice provider's values", async () => {
    memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "gemini-transcribe", variables: GEMINI_VOICE }));
    const first = await launch();
    act(() => {
      app.updateVoiceProviderConfig("openai", OPENAI_VOICE);
      app.updateVoiceProviderConfig("groq", GROQ_VOICE);
    });
    act(() => app.activateVoiceProvider("groq"));
    act(() => app.setOtherVoiceProvider("openai"));
    first.unmount();

    await launch();

    expect(app.selectedSttProvider).toEqual({ provider: "groq", variables: GROQ_VOICE });
    expect(app.voiceProviderConfigs).toEqual({
      "gemini-transcribe": GEMINI_VOICE,
      openai: OPENAI_VOICE,
      groq: GROQ_VOICE,
    });
    expect(app.otherVoiceProviderId).toBe("openai");
  });

  it("keeps older builds' unknown voice selections on Gemini Voice with their key, as before", async () => {
    memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "old-whisper", variables: { api_key: "kept", model: "x" } }));
    await launch();

    expect(app.selectedSttProvider).toEqual({ provider: "gemini-transcribe", variables: { api_key: "kept", model: "x" } });
  });

  it("ignores unknown voice provider IDs", async () => {
    memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "gemini-transcribe", variables: GEMINI_VOICE }));
    await launch();

    act(() => {
      app.updateVoiceProviderConfig("not-a-provider", { api_key: "x" });
      app.activateVoiceProvider("not-a-provider");
    });

    expect(app.selectedSttProvider.provider).toBe("gemini-transcribe");
    expect(app.voiceProviderConfigs).toEqual({ "gemini-transcribe": GEMINI_VOICE });
  });

  it("never writes API keys to the console", async () => {
    const log = vi.spyOn(console, "log");
    memory.set("curl_selected_stt_provider", JSON.stringify({ provider: "gemini-transcribe", variables: GEMINI_VOICE }));
    await launch();
    act(() => app.updateVoiceProviderConfig("gemini-transcribe", { ...GEMINI_VOICE, model: "gemini-3.8-live-extended-thinking" }));

    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain(GEMINI_VOICE.api_key);
  });
});
