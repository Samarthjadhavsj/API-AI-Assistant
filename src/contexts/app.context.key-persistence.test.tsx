import { act, render, type RenderResult } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { AppProvider, useApp } from "./app.context";
import { createSttAdapter } from "@/lib/stt/sttAdapterFactory";
import type { IContextType } from "@/types";

/**
 * An API key, once entered, stays saved until the user clears, replaces or
 * removes it — through restarts, provider/model changes, voice failures and
 * hydration. Every key here is fake, and no test may log one.
 */

vi.mock("@tauri-apps/plugin-autostart", () => ({ enable: vi.fn(), disable: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@/lib", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib")>()),
  trackAppStart: vi.fn(async () => {}),
}));

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

const GEMINI_VOICE = "gemini-transcribe";
const VOICE_KEY = "fake-voice-key-7Q2";
const AI_KEY = "fake-ai-key-4R9";
const LIVE_MODEL = "gemini-3.5-transcribe-live";
const OTHER_LIVE_MODEL = "gemini-3.1-flash-live-preview";
/** Every fake key a test enters, so console output can be checked for them. */
const enteredKeys = new Set<string>([VOICE_KEY, AI_KEY]);
const fakeKey = (label: string) => {
  const key = `fake-key-${label}`;
  enteredKeys.add(key);
  return key;
};

let app: IContextType;
const Capture = () => {
  app = useApp();
  return null;
};

/** Starts the app (again): the context loads everything from storage. */
const launch = async (extra?: ReactNode) => {
  const view = render(
    <AppProvider>
      <Capture />
      {extra}
    </AppProvider>
  );
  await act(async () => {});
  return view;
};
const restart = async (view: RenderResult) => {
  view.unmount();
  return launch();
};

/** Types a key into Gemini Voice's key field, as the settings page does. */
const enterVoiceKey = (key = VOICE_KEY) =>
  act(() =>
    app.updateVoiceProviderConfig(GEMINI_VOICE, {
      ...app.voiceProviderConfigs[GEMINI_VOICE],
      api_key: key,
    })
  );
const enterAiKey = (key = AI_KEY) =>
  act(() => app.updateAiProviderConfig("gemini", { ...app.aiProviderConfigs.gemini, api_key: key }));

/** The Gemini Voice key in each place it's kept: in use, and both saved copies. */
const voiceKeys = () => ({
  inUse: app.selectedSttProvider.provider === GEMINI_VOICE ? app.selectedSttProvider.variables.api_key : undefined,
  config: saved("voice_provider_configs")?.[GEMINI_VOICE]?.api_key,
  selection:
    saved("curl_selected_stt_provider")?.provider === GEMINI_VOICE
      ? saved("curl_selected_stt_provider").variables.api_key
      : undefined,
});
const aiKeys = () => ({
  inUse: app.selectedAIProvider.provider === "gemini" ? app.selectedAIProvider.variables.api_key : undefined,
  config: saved("ai_provider_configs")?.gemini?.api_key,
  selection:
    saved("curl_selected_ai_provider")?.provider === "gemini"
      ? saved("curl_selected_ai_provider").variables.api_key
      : undefined,
});
const everywhere = (key: string) => ({ inUse: key, config: key, selection: key });

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

beforeEach(() => {
  memory.clear();
  (globalThis as any).localStorage = memoryStorage;
  for (const method of CONSOLE_METHODS) vi.spyOn(console, method).mockImplementation(() => {});
  // A fresh install that already uses Gemini for answers and voice.
  memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: { api_key: "", model: "gemini-3.5-flash-lite" } }));
  memory.set("curl_selected_stt_provider", JSON.stringify({ provider: GEMINI_VOICE, variables: { api_key: "", model: LIVE_MODEL } }));
});

afterEach(() => {
  // 10. No console output ever contains an API key.
  const output = CONSOLE_METHODS.flatMap((method) => vi.mocked(console[method]).mock.calls)
    .map((args) =>
      args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(" ")
    )
    .join("\n");
  for (const key of enteredKeys) expect(output).not.toContain(key);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API keys stay saved", () => {
  it("1. entered keys survive a restart", async () => {
    let view = await launch();
    enterVoiceKey();
    enterAiKey();

    view = await restart(view);
    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    expect(aiKeys()).toEqual(everywhere(AI_KEY));

    view = await restart(view);
    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    expect(aiKeys()).toEqual(everywhere(AI_KEY));
  });

  it("2. changing the model keeps the key (full or partial update)", async () => {
    let view = await launch();
    enterVoiceKey();
    enterAiKey();

    // As the settings page sends it: every field, one changed
    act(() =>
      app.updateVoiceProviderConfig(GEMINI_VOICE, { ...app.voiceProviderConfigs[GEMINI_VOICE], model: OTHER_LIVE_MODEL })
    );
    act(() => app.updateAiProviderConfig("gemini", { ...app.aiProviderConfigs.gemini, model: "gemini-3.5-pro" }));
    // Or only the model
    act(() => app.updateVoiceProviderConfig(GEMINI_VOICE, { model: LIVE_MODEL }));
    act(() => app.updateAiProviderConfig("gemini", { model: "gemini-3.5-flash-lite" }));

    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    expect(app.selectedSttProvider.variables.model).toBe(LIVE_MODEL);
    expect(aiKeys()).toEqual(everywhere(AI_KEY));
    view = await restart(view);
    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    expect(aiKeys()).toEqual(everywhere(AI_KEY));
  });

  it("3. changing the AI provider or model keeps the voice key", async () => {
    let view = await launch();
    enterVoiceKey();
    const claudeKey = fakeKey("claude");

    act(() => app.updateAiProviderConfig("claude", { api_key: claudeKey, model: "claude-model" }));
    act(() => app.activateAiProvider("claude"));
    act(() => app.onSetSelectedAIProvider({ provider: "gemini", variables: { model: "gemini-3.5-pro" } }));
    act(() => app.activateAiProvider("claude"));

    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    view = await restart(view);
    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    expect(app.aiProviderConfigs.claude.api_key).toBe(claudeKey);
  });

  it("4. changing the voice provider or model keeps the AI key", async () => {
    let view = await launch();
    enterAiKey();
    const openaiVoiceKey = fakeKey("openai-voice");

    act(() => app.updateVoiceProviderConfig("openai", { api_key: openaiVoiceKey, model: "whisper-1" }));
    act(() => app.activateVoiceProvider("openai"));
    act(() => app.updateVoiceProviderConfig("openai", { ...app.voiceProviderConfigs.openai, model: "gpt-4o-transcribe" }));
    act(() => app.activateVoiceProvider(GEMINI_VOICE));
    act(() => app.updateVoiceProviderConfig(GEMINI_VOICE, { model: OTHER_LIVE_MODEL }));

    expect(aiKeys()).toEqual(everywhere(AI_KEY));
    view = await restart(view);
    expect(aiKeys()).toEqual(everywhere(AI_KEY));
    expect(app.voiceProviderConfigs.openai.api_key).toBe(openaiVoiceKey);
  });

  describe("5. voice, network and provider failures keep the key", () => {
    const audio = () => ({
      blob: new Blob([new Uint8Array(64)], { type: "audio/webm" }),
      mimeType: "audio/webm",
      durationMs: 500,
      sizeBytes: 64,
      deviceId: null,
      chunkCount: 1,
    });
    const storedSettings = () =>
      ["curl_selected_stt_provider", "voice_provider_configs", "curl_selected_ai_provider", "ai_provider_configs"].map(
        (key) => memory.get(key)
      );
    const voiceAdapter = () =>
      createSttAdapter(
        app.allSttProviders.find((provider) => provider.id === app.selectedSttProvider.provider),
        app.selectedSttProvider
      );

    it("a Live WebSocket that fails to connect", async () => {
      vi.stubGlobal(
        "WebSocket",
        class {
          static OPEN = 1;
          readyState = 0;
          onerror: ((event: Event) => void) | null = null;
          constructor() {
            setTimeout(() => this.onerror?.(new Event("error")));
          }
          send() {}
          close() {}
        }
      );
      let view = await launch();
      enterVoiceKey();
      enterAiKey();
      const before = storedSettings();

      const adapter = voiceAdapter();
      expect(adapter?.kind).toBe("live-websocket");
      await expect(
        adapter!.transcribe(audio(), { signal: new AbortController().signal })
      ).rejects.toThrow("WebSocket connection failed");

      expect(storedSettings()).toEqual(before);
      view = await restart(view);
      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(aiKeys()).toEqual(everywhere(AI_KEY));
    });

    it("network and quota errors from batch transcription", async () => {
      let view = await launch();
      enterVoiceKey();
      act(() =>
        app.updateVoiceProviderConfig(GEMINI_VOICE, { ...app.voiceProviderConfigs[GEMINI_VOICE], model: "gemini-3.5-transcribe" })
      );
      const before = storedSettings();

      vi.mocked(tauriFetch).mockRejectedValueOnce(new TypeError("network error"));
      await expect(voiceAdapter()!.transcribe(audio(), { signal: new AbortController().signal })).rejects.toBeTruthy();
      vi.mocked(tauriFetch).mockResolvedValue(
        new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "quota exceeded" } }), {
          status: 429,
        })
      );
      await expect(voiceAdapter()!.transcribe(audio(), { signal: new AbortController().signal })).rejects.toBeTruthy();

      expect(storedSettings()).toEqual(before);
      view = await restart(view);
      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(app.selectedSttProvider.variables.model).toBe("gemini-3.5-transcribe");
    });

    it("a voice provider that isn't set up (no adapter)", async () => {
      await launch();
      enterVoiceKey();
      act(() => app.activateVoiceProvider("openai"));
      const before = storedSettings();

      expect(voiceAdapter()).toBeNull();

      expect(storedSettings()).toEqual(before);
      expect(app.voiceProviderConfigs[GEMINI_VOICE].api_key).toBe(VOICE_KEY);
    });
  });

  describe("6. reload, hydration and updates keep the key", () => {
    it("changes made before startup finished loading can't erase a saved key", async () => {
      memory.set("curl_selected_stt_provider", JSON.stringify({ provider: GEMINI_VOICE, variables: { api_key: VOICE_KEY, model: LIVE_MODEL } }));
      memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: { api_key: AI_KEY, model: "gemini-3.5-flash-lite" } }));

      // Child effects run before the provider's own startup effects.
      const EarlySettingsChange = () => {
        const early = useApp();
        useEffect(() => {
          early.activateVoiceProvider(GEMINI_VOICE);
          early.updateVoiceProviderConfig(GEMINI_VOICE, {
            ...early.voiceProviderConfigs[GEMINI_VOICE],
            model: OTHER_LIVE_MODEL,
          });
          early.activateAiProvider("gemini");
          early.updateAiProviderConfig("gemini", { ...early.aiProviderConfigs.gemini, model: "gemini-3.5-pro" });
        }, []); // eslint-disable-line react-hooks/exhaustive-deps
        return null;
      };

      const view = await launch(<EarlySettingsChange />);
      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(aiKeys()).toEqual(everywhere(AI_KEY));

      await restart(view);
      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(aiKeys()).toEqual(everywhere(AI_KEY));
    });

    it("a key kept in only one saved copy is restored and used", async () => {
      // The selection lost its key; the per-provider copy still has it.
      memory.set("curl_selected_stt_provider", JSON.stringify({ provider: GEMINI_VOICE, variables: { api_key: "", model: LIVE_MODEL } }));
      memory.set("voice_provider_configs", JSON.stringify({ [GEMINI_VOICE]: { api_key: VOICE_KEY, model: LIVE_MODEL } }));
      // The per-provider copy has no key field; the selection has the key.
      memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: { api_key: AI_KEY, model: "gemini-3.5-flash-lite" } }));
      memory.set("ai_provider_configs", JSON.stringify({ gemini: { model: "gemini-3.5-flash-lite" } }));

      const view = await launch();
      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(createSttAdapter(app.allSttProviders[0], app.selectedSttProvider)).not.toBeNull();
      expect(app.selectedAIProvider.variables.api_key).toBe(AI_KEY);
      expect(app.aiProviderConfigs.gemini.api_key).toBe(AI_KEY);

      await restart(view);
      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(app.aiProviderConfigs.gemini.api_key).toBe(AI_KEY);
    });

    it("reloading from storage (another window saved) keeps the key", async () => {
      await launch();
      enterVoiceKey();
      enterAiKey();

      act(() => app.loadData());
      act(() => app.loadData());

      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(aiKeys()).toEqual(everywhere(AI_KEY));
    });

    it("an update from an older build keeps its saved key and model", async () => {
      // Older builds saved only the active selection, with the batch model.
      memory.clear();
      memory.set("curl_selected_stt_provider", JSON.stringify({ provider: GEMINI_VOICE, variables: { api_key: VOICE_KEY, model: "gemini-3.5-transcribe" } }));
      memory.set("curl_selected_ai_provider", JSON.stringify({ provider: "gemini", variables: { api_key: AI_KEY, model: "gemini-3.5-flash-lite" } }));

      const view = await launch();
      expect(voiceKeys().inUse).toBe(VOICE_KEY);
      expect(app.selectedSttProvider.variables.model).toBe("gemini-3.5-transcribe");
      expect(app.voiceProviderConfigs[GEMINI_VOICE].api_key).toBe(VOICE_KEY);
      expect(aiKeys().inUse).toBe(AI_KEY);

      // The first save writes the per-provider copy with the key in it.
      act(() => app.updateVoiceProviderConfig(GEMINI_VOICE, { ...app.voiceProviderConfigs[GEMINI_VOICE], model: LIVE_MODEL }));
      await restart(view);
      expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
      expect(aiKeys().inUse).toBe(AI_KEY);
    });
  });

  it("7. clearing the field or removing the provider does remove the key", async () => {
    let view = await launch();
    enterVoiceKey();
    enterAiKey();
    const claudeKey = fakeKey("claude-removed");
    act(() => app.updateAiProviderConfig("claude", { api_key: claudeKey, model: "claude-model" }));
    view = await restart(view);

    // Clearing the key field (the settings page sends every field, the key empty)
    enterVoiceKey("");
    enterAiKey("");
    act(() => app.removeAiProviderConfig("claude"));

    expect(voiceKeys()).toEqual(everywhere(""));
    expect(aiKeys()).toEqual(everywhere(""));
    expect(saved("ai_provider_configs").claude).toBeUndefined();
    expect(createSttAdapter(app.allSttProviders[0], app.selectedSttProvider)).toBeNull();

    // …and stays removed: nothing brings it back on restart.
    view = await restart(view);
    expect(voiceKeys()).toEqual(everywhere(""));
    expect(aiKeys()).toEqual(everywhere(""));
    expect(app.aiProviderConfigs.claude).toBeUndefined();

    // Replacing a key is an explicit change too.
    const replacement = fakeKey("replacement");
    enterVoiceKey(replacement);
    await restart(view);
    expect(voiceKeys()).toEqual(everywhere(replacement));
  });

  it("8. switching between every provider keeps each provider's own key", async () => {
    let view = await launch();
    const aiIds = app.allAiProviders.map((provider) => provider.id!).filter(Boolean);
    const voiceIds = app.allSttProviders.map((provider) => provider.id!).filter(Boolean);
    const aiKey = (id: string) => fakeKey(`ai-${id}`);
    const voiceKey = (id: string) => fakeKey(`voice-${id}`);

    for (const id of aiIds) {
      act(() => app.updateAiProviderConfig(id, { ...app.aiProviderConfigs[id], api_key: aiKey(id), model: `model-${id}` }));
    }
    for (const id of voiceIds) {
      act(() => app.updateVoiceProviderConfig(id, { ...app.voiceProviderConfigs[id], api_key: voiceKey(id), model: `model-${id}` }));
    }

    const expectEveryKey = () => {
      for (const id of aiIds) expect(app.aiProviderConfigs[id]?.api_key, `AI ${id}`).toBe(aiKey(id));
      for (const id of voiceIds) expect(app.voiceProviderConfigs[id]?.api_key, `voice ${id}`).toBe(voiceKey(id));
    };

    for (const id of aiIds) {
      act(() => app.activateAiProvider(id));
      expect(app.selectedAIProvider.variables.api_key).toBe(aiKey(id));
      expectEveryKey();
    }
    for (const id of voiceIds) {
      act(() => app.activateVoiceProvider(id));
      expect(app.selectedSttProvider.variables.api_key).toBe(voiceKey(id));
      expectEveryKey();
    }

    view = await restart(view);
    expectEveryKey();
    // And back again after the restart
    act(() => app.activateAiProvider(aiIds[0]));
    act(() => app.activateVoiceProvider(voiceIds[0]));
    expect(app.selectedAIProvider.variables.api_key).toBe(aiKey(aiIds[0]));
    expect(app.selectedSttProvider.variables.api_key).toBe(voiceKey(voiceIds[0]));
    expectEveryKey();
  });

  it("9. empty or undefined incoming settings never overwrite a saved key", async () => {
    let view = await launch();
    enterVoiceKey();
    enterAiKey();

    act(() => {
      app.updateVoiceProviderConfig(GEMINI_VOICE, {});
      app.updateVoiceProviderConfig(GEMINI_VOICE, { model: undefined } as unknown as Record<string, string>);
      app.updateVoiceProviderConfig(GEMINI_VOICE, { api_key: undefined } as unknown as Record<string, string>);
      app.onSetSelectedSttProvider({ provider: GEMINI_VOICE, variables: {} });
      app.updateAiProviderConfig("gemini", {});
      app.updateAiProviderConfig("gemini", { api_key: undefined } as unknown as Record<string, string>);
      app.onSetSelectedAIProvider({ provider: "gemini", variables: {} });
    });

    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    expect(app.selectedSttProvider.variables.model).toBe(LIVE_MODEL);
    expect(aiKeys()).toEqual(everywhere(AI_KEY));
    view = await restart(view);
    expect(voiceKeys()).toEqual(everywhere(VOICE_KEY));
    expect(aiKeys()).toEqual(everywhere(AI_KEY));
  });
});
