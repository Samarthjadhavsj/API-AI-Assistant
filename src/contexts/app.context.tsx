import {
  AI_PROVIDERS,
  DEFAULT_SYSTEM_PROMPT,
  GEMINI_TRANSCRIBE_LIVE_MODEL,
  GEMINI_TRANSCRIBE_PROVIDER_ID,
  SPEECH_TO_TEXT_PROVIDERS,
  STORAGE_KEYS,
} from "@/config";
import { getPlatform, safeLocalStorage, trackAppStart } from "@/lib";
import {
  getCustomizableState,
  setCustomizableState,
  updateAppIconVisibility,
  updateAlwaysOnTop,
  updateAutostart,
  CustomizableState,
  DEFAULT_CUSTOMIZABLE_STATE,
  CursorType,
  updateCursorType,
} from "@/lib/storage";
import { IContextType, ScreenshotConfig, TYPE_PROVIDER } from "@/types";
import {
  GEMINI_AI_PROVIDER_ID,
  mergeProviderVariables,
  restoreAiProviderSettings,
  restoreVoiceProviderSettings,
  type AiProviderConfigs,
  type ProviderVariables,
} from "@/lib/provider-settings";
import {
  CUSTOM_VOICE_PROVIDER,
  VOICE_PROVIDERS,
  findVoiceProvider,
} from "@/config/voice-providers.constants";
import curl2Json from "@bany/curl-to-json";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const validateAndProcessCurlProviders = (
  providersJson: string,
  providerType: "AI" | "STT"
): TYPE_PROVIDER[] => {
  try {
    const parsed = JSON.parse(providersJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((p) => {
        try {
          curl2Json(p.curl);
          return true;
        } catch (e) {
          return false;
        }

        return true;
      })
      .map((p) => {
        const provider = { ...p, isCustom: true };
        if (providerType === "STT" && provider.curl) {
          provider.curl = provider.curl.replace(/AUDIO_BASE64/g, "AUDIO");
        }
        return provider;
      });
  } catch (e) {
    console.warn(`Failed to parse custom ${providerType} providers`, e);
    return [];
  }
};

type SttSelection = { provider: string; variables: Record<string, string> };

const isVoiceProviderId = (id: string | undefined): id is string =>
  !!id && (id === GEMINI_TRANSCRIBE_PROVIDER_ID || !!findVoiceProvider(id));

const stringVariables = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {};

/**
 * A saved voice selection as used by voice input: a known voice provider with
 * its own values, or Gemini Voice (older builds' providers migrate to it,
 * keeping the API key, as before). Gemini Voice keeps { api_key, model }.
 */
const normalizeSttSelection = (
  saved: { provider?: string; variables?: unknown } | null
): SttSelection => {
  const provider = isVoiceProviderId(saved?.provider) ? saved!.provider! : GEMINI_TRANSCRIBE_PROVIDER_ID;
  const variables = stringVariables(saved?.variables);
  if (provider === GEMINI_TRANSCRIBE_PROVIDER_ID) {
    return {
      provider,
      variables: {
        api_key: variables.api_key || "",
        model: variables.model ?? GEMINI_TRANSCRIBE_LIVE_MODEL,
      },
    };
  }
  return { provider, variables };
};

/** Voice input's selection on a fresh install. */
const DEFAULT_STT_SELECTION: SttSelection = {
  provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
  variables: { model: GEMINI_TRANSCRIBE_LIVE_MODEL, api_key: "" },
};

const readSavedJson = (key: string): unknown => {
  const raw = safeLocalStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Every saved AI and voice provider setting, read in one go: when the app
 * starts (so nothing renders or saves before the saved keys are known) and
 * whenever storage changes. Each active selection is rebuilt from its
 * provider's restored settings, so a key kept in either saved copy is used.
 * `currentStt` is the voice selection to keep when none is saved.
 */
const readSavedProviderSettings = (currentStt: SttSelection) => {
  const savedAi = readSavedJson(STORAGE_KEYS.SELECTED_AI_PROVIDER) as {
    provider?: unknown;
    variables?: unknown;
  } | null;
  const activeAi =
    savedAi && typeof savedAi === "object" && typeof savedAi.provider === "string"
      ? { provider: savedAi.provider, variables: stringVariables(savedAi.variables) }
      : null;
  const ai = restoreAiProviderSettings({
    configsRaw: safeLocalStorage.getItem(STORAGE_KEYS.AI_PROVIDER_CONFIGS),
    otherProviderRaw: safeLocalStorage.getItem(STORAGE_KEYS.OTHER_AI_PROVIDER),
    active: activeAi,
  });

  // Known voice providers are kept; older builds' selections migrate to
  // Gemini Voice, retaining the API key.
  const savedStt = readSavedJson(STORAGE_KEYS.SELECTED_STT_PROVIDER);
  const activeStt = savedStt
    ? normalizeSttSelection(savedStt as { provider?: string; variables?: unknown })
    : null;
  const voice = restoreVoiceProviderSettings({
    configsRaw: safeLocalStorage.getItem(STORAGE_KEYS.VOICE_PROVIDER_CONFIGS),
    otherProviderRaw: safeLocalStorage.getItem(STORAGE_KEYS.OTHER_VOICE_PROVIDER),
    active: activeStt,
  });
  const sttProvider = (activeStt ?? currentStt).provider;

  return {
    ai,
    selectedAi: activeAi && {
      provider: activeAi.provider,
      variables: (activeAi.provider && ai.configs[activeAi.provider]) || activeAi.variables,
    },
    voice,
    hasSavedStt: !!activeStt,
    selectedStt: normalizeSttSelection({
      provider: sttProvider,
      variables:
        voice.configs[sttProvider] ??
        (sttProvider === currentStt.provider ? currentStt.variables : {}),
    }),
  };
};

/** Voice providers as provider records (Gemini Voice first), for voice input. */
const VOICE_PROVIDER_RECORDS: TYPE_PROVIDER[] = [...VOICE_PROVIDERS, CUSTOM_VOICE_PROVIDER].map(
  (provider) => ({
    id: provider.id,
    name: provider.name,
    curl: provider.endpoint ? `curl -X POST "${provider.endpoint}"` : "",
    streaming: false,
  })
);

// Create the context
const AppContext = createContext<IContextType | undefined>(undefined);

// Create the provider component
export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [systemPrompt, setSystemPrompt] = useState<string>(
    safeLocalStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) ||
      DEFAULT_SYSTEM_PROMPT
  );

  const [selectedAudioDevices, setSelectedAudioDevices] = useState<{
    input: string;
    output: string;
  }>({
    input:
      safeLocalStorage.getItem(STORAGE_KEYS.SELECTED_AUDIO_INPUT_DEVICE) || "",
    output:
      safeLocalStorage.getItem(STORAGE_KEYS.SELECTED_AUDIO_OUTPUT_DEVICE) || "",
  });

  // Saved provider settings, read before the first render: until loadData()
  // ran, settings used to start empty, and anything saved in that window
  // (a provider switch, a model change) could replace a saved API key.
  const [initialProviderSettings] = useState(() =>
    readSavedProviderSettings(DEFAULT_STT_SELECTION)
  );

  // AI Providers
  const [customAiProviders, setCustomAiProviders] = useState<TYPE_PROVIDER[]>(
    []
  );
  const [selectedAIProvider, setSelectedAIProvider] = useState<{
    provider: string;
    variables: Record<string, string>;
  }>(() => initialProviderSettings.selectedAi ?? { provider: "", variables: {} });

  // Every AI provider's own settings, so switching provider never erases them.
  const [aiProviderConfigs, setAiProviderConfigs] = useState<AiProviderConfigs>(
    initialProviderSettings.ai.configs
  );
  const aiProviderConfigsRef = useRef<AiProviderConfigs>(initialProviderSettings.ai.configs);
  // The provider shown under "Other AI providers".
  const [otherAiProviderId, setOtherAiProviderIdState] = useState(
    initialProviderSettings.ai.otherProviderId
  );
  // Every voice provider's own settings (Gemini Voice included).
  const [voiceProviderConfigs, setVoiceProviderConfigs] = useState<AiProviderConfigs>(
    initialProviderSettings.voice.configs
  );
  const voiceProviderConfigsRef = useRef<AiProviderConfigs>(initialProviderSettings.voice.configs);
  // The provider shown under "Other voice providers".
  const [otherVoiceProviderId, setOtherVoiceProviderIdState] = useState(
    initialProviderSettings.voice.otherProviderId
  );

  // Keep the legacy curl-based custom STT provider state for backwards-
  // compatible settings storage; it isn't used for voice.
  const [customSttProviders, setCustomSttProviders] = useState<TYPE_PROVIDER[]>(
    []
  );
  
  // Initialize with saved value from localStorage to prevent empty state overwriting saved data
  const [selectedSttProvider, setSelectedSttProvider] = useState<{
    provider: string;
    variables: Record<string, string>;
  }>(() => {
    // Logs never include API keys
    console.log(
      initialProviderSettings.hasSavedStt
        ? `[AppContext] Loaded STT provider from localStorage: ${initialProviderSettings.selectedStt.provider}`
        : "[AppContext] Using default STT provider state"
    );
    return initialProviderSettings.selectedStt;
  });
  const selectedSttProviderRef = useRef(selectedSttProvider);
  selectedSttProviderRef.current = selectedSttProvider;

  const [screenshotConfiguration, setScreenshotConfiguration] =
    useState<ScreenshotConfig>({
      mode: "manual",
      autoPrompt: "Analyze this screenshot and provide insights",
      enabled: true,
    });

  // Unified Customizable State
  const [customizable, setCustomizable] = useState<CustomizableState>(
    DEFAULT_CUSTOMIZABLE_STATE
  );
  // Function to load AI, STT, system prompt and screenshot config data from storage
  const loadData = () => {
    // Load system prompt
    const savedSystemPrompt = safeLocalStorage.getItem(
      STORAGE_KEYS.SYSTEM_PROMPT
    );
    if (savedSystemPrompt) {
      setSystemPrompt(savedSystemPrompt || DEFAULT_SYSTEM_PROMPT);
    }

    // Load screenshot configuration
    const savedScreenshotConfig = safeLocalStorage.getItem(
      STORAGE_KEYS.SCREENSHOT_CONFIG
    );
    if (savedScreenshotConfig) {
      try {
        const parsed = JSON.parse(savedScreenshotConfig);
        if (typeof parsed === "object" && parsed !== null) {
          setScreenshotConfiguration({
            mode: parsed.mode || "manual",
            autoPrompt:
              parsed.autoPrompt ||
              "Analyze this screenshot and provide insights",
            enabled: parsed.enabled !== undefined ? parsed.enabled : false,
          });
        }
      } catch {
        console.warn("Failed to parse screenshot configuration");
      }
    }

    // Load custom AI providers
    const savedAi = safeLocalStorage.getItem(STORAGE_KEYS.CUSTOM_AI_PROVIDERS);
    let aiList: TYPE_PROVIDER[] = [];
    if (savedAi) {
      aiList = validateAndProcessCurlProviders(savedAi, "AI");
    }
    setCustomAiProviders(aiList);

    // Other STT providers are no longer part of this build.
    setCustomSttProviders([]);

    // Selected AI and voice providers, and each provider's own settings (older
    // installs only saved the active one). Logs never include API keys.
    const saved = readSavedProviderSettings(selectedSttProviderRef.current);
    if (saved.selectedAi) {
      setSelectedAIProvider(saved.selectedAi);
    }
    aiProviderConfigsRef.current = saved.ai.configs;
    setAiProviderConfigs(saved.ai.configs);
    setOtherAiProviderIdState(saved.ai.otherProviderId);

    console.log(
      saved.hasSavedStt
        ? `[AppContext.loadData] Loaded STT provider: ${saved.selectedStt.provider}`
        : "[AppContext.loadData] No saved STT provider found in localStorage"
    );
    setSelectedSttProvider(saved.selectedStt);
    voiceProviderConfigsRef.current = saved.voice.configs;
    setVoiceProviderConfigs(saved.voice.configs);
    setOtherVoiceProviderIdState(saved.voice.otherProviderId);

    // Load customizable state
    const customizableState = getCustomizableState();
    setCustomizable(customizableState);

    updateCursor(customizableState.cursor.type || "invisible");

    const stored = safeLocalStorage.getItem(STORAGE_KEYS.CUSTOMIZABLE);
    if (!stored) {
      // save the default state
      setCustomizableState(customizableState);
    } else {
      // check if we need to update the schema
      try {
        const parsed = JSON.parse(stored);
        
        // Force reset appIcon visibility to false (for taskbar fix)
        const migrationKey = "taskbar-fix-v0.1.8";
        const migrationDone = safeLocalStorage.getItem(migrationKey);
        if (!migrationDone) {
          parsed.appIcon = { isVisible: false };
          safeLocalStorage.setItem(STORAGE_KEYS.CUSTOMIZABLE, JSON.stringify(parsed));
          safeLocalStorage.setItem(migrationKey, "true");
          console.log("Applied taskbar visibility fix migration");
        }
        
        if (!parsed.autostart) {
          // save the merged state with new autostart property
          setCustomizableState(customizableState);
          updateCursor(customizableState.cursor.type || "invisible");
        }
      } catch (error) {
        console.debug("Failed to check customizable state schema:", error);
      }
    }

  };

  const updateCursor = (type: CursorType | undefined) => {
    try {
      const platform = getPlatform();
      // For Linux, always use default cursor
      if (platform === "linux") {
        document.documentElement.style.setProperty("--cursor-type", "default");
        return;
      }
      // The main window normally follows the stealth cursor preference, but
      // settings is an interactive route and must never hide the pointer.
      if (window.location.pathname.startsWith("/toggle/settings")) {
        document.documentElement.style.setProperty("--cursor-type", "default");
        return;
      }

      // For overlay windows (main, capture-overlay-*)
      const safeType = type || "invisible";
      const cursorValue = type === "invisible" ? "none" : safeType;
      document.documentElement.style.setProperty("--cursor-type", cursorValue);
    } catch (error) {
      document.documentElement.style.setProperty("--cursor-type", "default");
    }
  };

  // Load data on mount
  useEffect(() => {
    const initializeApp = async () => {
      // Track app start
      try {
        const appVersion = await invoke<string>("get_app_version");
        await trackAppStart(appVersion, "");
      } catch (error) {
        console.debug("Failed to track app start:", error);
      }
    };
    // Load data
    loadData();
    initializeApp();
  }, []);

  // Handle customizable settings on state changes
  useEffect(() => {
    const applyCustomizableSettings = async () => {
      try {
        await Promise.all([
          invoke("set_app_icon_visibility", {
            visible: customizable.appIcon.isVisible,
          }),
          invoke("set_always_on_top", {
            enabled: customizable.alwaysOnTop.isEnabled,
          }),
        ]);
      } catch (error) {
        console.error("Failed to apply customizable settings:", error);
      }
    };

    applyCustomizableSettings();
  }, [customizable]);

  useEffect(() => {
    const initializeAutostart = async () => {
      try {
        const autostartInitialized = safeLocalStorage.getItem(
          STORAGE_KEYS.AUTOSTART_INITIALIZED
        );

        // Only apply autostart on the very first launch
        if (!autostartInitialized) {
          const autostartEnabled = customizable?.autostart?.isEnabled ?? false;

          if (autostartEnabled) {
            await enable();
          } else {
            await disable();
          }

          // Mark as initialized so this never runs again
          safeLocalStorage.setItem(STORAGE_KEYS.AUTOSTART_INITIALIZED, "true");
        }
      } catch (error) {
        console.debug("Autostart initialization skipped:", error);
      }
    };

    initializeAutostart();
  }, []);

  // Listen for app icon hide/show events when window is toggled
  useEffect(() => {
    const handleAppIconVisibility = async (isVisible: boolean) => {
      try {
        await invoke("set_app_icon_visibility", { visible: isVisible });
      } catch (error) {
        console.error("Failed to set app icon visibility:", error);
      }
    };

    const unlistenHide = listen("handle-app-icon-on-hide", async () => {
      const currentState = getCustomizableState();
      // Only hide app icon if user has set it to hide mode
      if (!currentState.appIcon.isVisible) {
        await handleAppIconVisibility(false);
      }
    });

    const unlistenShow = listen("handle-app-icon-on-show", async () => {
      // Always show app icon when window is shown, regardless of user setting
      await handleAppIconVisibility(true);
    });

    return () => {
      unlistenHide.then((fn) => fn());
      unlistenShow.then((fn) => fn());
    };
  }, []);

  // Listen to storage events for real-time sync (e.g., multi-tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEYS.CUSTOM_AI_PROVIDERS ||
        e.key === STORAGE_KEYS.SELECTED_AI_PROVIDER ||
        e.key === STORAGE_KEYS.AI_PROVIDER_CONFIGS ||
        e.key === STORAGE_KEYS.OTHER_AI_PROVIDER ||
        e.key === STORAGE_KEYS.OTHER_VOICE_PROVIDER ||
        e.key === STORAGE_KEYS.VOICE_PROVIDER_CONFIGS ||
        e.key === STORAGE_KEYS.CUSTOM_SPEECH_PROVIDERS ||
        e.key === STORAGE_KEYS.SELECTED_STT_PROVIDER ||
        e.key === STORAGE_KEYS.SYSTEM_PROMPT ||
        e.key === STORAGE_KEYS.SCREENSHOT_CONFIG ||
        e.key === STORAGE_KEYS.CUSTOMIZABLE
      ) {
        loadData();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Sync selected AI to localStorage
  useEffect(() => {
    if (selectedAIProvider.provider) {
      safeLocalStorage.setItem(
        STORAGE_KEYS.SELECTED_AI_PROVIDER,
        JSON.stringify(selectedAIProvider)
      );
    }
  }, [selectedAIProvider]);

  // Sync selected STT to localStorage
  useEffect(() => {
    if (selectedSttProvider.provider) {
      console.log("[AppContext] Saving STT provider to localStorage:", selectedSttProvider.provider);
      safeLocalStorage.setItem(
        STORAGE_KEYS.SELECTED_STT_PROVIDER,
        JSON.stringify(selectedSttProvider)
      );
    }
  }, [selectedSttProvider]);

  // Computed all AI providers
  const allAiProviders: TYPE_PROVIDER[] = [
    ...AI_PROVIDERS,
    ...customAiProviders,
  ];

  // Computed all STT providers: Gemini Voice, then the other voice providers
  const allSttProviders: TYPE_PROVIDER[] = [
    ...SPEECH_TO_TEXT_PROVIDERS,
    ...VOICE_PROVIDER_RECORDS,
  ];

  const onSetSelectedAIProvider = ({
    provider,
    variables,
  }: {
    provider: string;
    variables: Record<string, string>;
  }) => {
    if (provider && !allAiProviders.some((p) => p.id === provider)) {
      console.warn(`Invalid AI provider ID: ${provider}`);
      return;
    }

    // Fields left out keep their saved values (the API key included).
    const merged = provider
      ? mergeProviderVariables(aiProviderConfigsRef.current[provider], variables)
      : variables;
    setSelectedAIProvider((prev) => ({
      ...prev,
      provider,
      variables: merged,
    }));
    if (provider) {
      saveAiProviderConfig(provider, merged);
      if (provider !== GEMINI_AI_PROVIDER_ID) setOtherAiProvider(provider);
    }
  };

  /** Records a provider's settings; fields the change leaves out keep their saved values. */
  const saveAiProviderConfig = (provider: string, variables: ProviderVariables) => {
    const merged = mergeProviderVariables(aiProviderConfigsRef.current[provider], variables);
    const next = { ...aiProviderConfigsRef.current, [provider]: merged };
    aiProviderConfigsRef.current = next;
    setAiProviderConfigs(next);
    safeLocalStorage.setItem(STORAGE_KEYS.AI_PROVIDER_CONFIGS, JSON.stringify(next));
    return merged;
  };

  /** Saves a provider's settings; the active provider's are used right away. */
  const updateAiProviderConfig = (provider: string, variables: ProviderVariables) => {
    if (!allAiProviders.some((p) => p.id === provider)) {
      console.warn(`Invalid AI provider ID: ${provider}`);
      return;
    }
    const merged = saveAiProviderConfig(provider, variables);
    setSelectedAIProvider((prev) =>
      prev.provider === provider ? { provider, variables: merged } : prev
    );
  };

  /** Forgets a provider's saved settings (e.g. a deleted custom endpoint's key). */
  const removeAiProviderConfig = (provider: string) => {
    if (!(provider in aiProviderConfigsRef.current)) return;
    const next = { ...aiProviderConfigsRef.current };
    delete next[provider];
    aiProviderConfigsRef.current = next;
    setAiProviderConfigs(next);
    safeLocalStorage.setItem(STORAGE_KEYS.AI_PROVIDER_CONFIGS, JSON.stringify(next));
  };

  /** Makes a provider answer questions, with its own saved settings. */
  const activateAiProvider = (provider: string) => {
    if (!allAiProviders.some((p) => p.id === provider)) {
      console.warn(`Invalid AI provider ID: ${provider}`);
      return;
    }
    setSelectedAIProvider({
      provider,
      variables: aiProviderConfigsRef.current[provider] ?? {},
    });
    if (provider !== GEMINI_AI_PROVIDER_ID) setOtherAiProvider(provider);
  };

  /** Chooses which provider "Other AI providers" shows (doesn't activate it). */
  const setOtherAiProvider = (provider: string) => {
    setOtherAiProviderIdState(provider);
    safeLocalStorage.setItem(STORAGE_KEYS.OTHER_AI_PROVIDER, provider);
  };

  const saveVoiceProviderConfig = (provider: string, variables: ProviderVariables) => {
    const merged = mergeProviderVariables(voiceProviderConfigsRef.current[provider], variables);
    const next = { ...voiceProviderConfigsRef.current, [provider]: merged };
    voiceProviderConfigsRef.current = next;
    setVoiceProviderConfigs(next);
    safeLocalStorage.setItem(STORAGE_KEYS.VOICE_PROVIDER_CONFIGS, JSON.stringify(next));
  };

  /**
   * A voice provider's settings with a change applied, as voice input uses
   * them. Merged before normalizing, so a field the change leaves out (the
   * API key during a model change) keeps its saved value instead of becoming "".
   */
  const voiceSelectionWith = (provider: string, variables: ProviderVariables) =>
    normalizeSttSelection({
      provider,
      variables: mergeProviderVariables(voiceProviderConfigsRef.current[provider], variables),
    });

  // Setter for selected STT with validation (also records that provider's settings)
  const onSetSelectedSttProvider = ({
    provider,
    variables,
  }: {
    provider: string;
    variables: Record<string, string>;
  }) => {
    if (!isVoiceProviderId(provider)) {
      console.warn(`Invalid STT provider ID: ${provider}`);
      return;
    }

    const selection = voiceSelectionWith(provider, variables);
    setSelectedSttProvider(selection);
    saveVoiceProviderConfig(provider, selection.variables);
    if (provider !== GEMINI_TRANSCRIBE_PROVIDER_ID) setOtherVoiceProvider(provider);
  };

  /** Saves a voice provider's settings; the active one's are used right away. */
  const updateVoiceProviderConfig = (provider: string, variables: ProviderVariables) => {
    if (!isVoiceProviderId(provider)) {
      console.warn(`Invalid STT provider ID: ${provider}`);
      return;
    }
    const selection = voiceSelectionWith(provider, variables);
    saveVoiceProviderConfig(provider, selection.variables);
    setSelectedSttProvider((prev) => (prev.provider === provider ? selection : prev));
  };

  /** Makes a provider transcribe voice input, with its own saved settings. */
  const activateVoiceProvider = (provider: string) => {
    if (!isVoiceProviderId(provider)) {
      console.warn(`Invalid STT provider ID: ${provider}`);
      return;
    }
    setSelectedSttProvider(
      normalizeSttSelection({ provider, variables: voiceProviderConfigsRef.current[provider] ?? {} })
    );
    if (provider !== GEMINI_TRANSCRIBE_PROVIDER_ID) setOtherVoiceProvider(provider);
  };

  /** Chooses which provider "Other voice providers" shows (doesn't activate it). */
  const setOtherVoiceProvider = (provider: string) => {
    setOtherVoiceProviderIdState(provider);
    safeLocalStorage.setItem(STORAGE_KEYS.OTHER_VOICE_PROVIDER, provider);
  };

  // Toggle handlers
  const toggleAppIconVisibility = async (isVisible: boolean) => {
    const newState = updateAppIconVisibility(isVisible);
    setCustomizable(newState);
    try {
      await invoke("set_app_icon_visibility", { visible: isVisible });
      loadData();
    } catch (error) {
      console.error("Failed to toggle app icon visibility:", error);
    }
  };

  const toggleAlwaysOnTop = async (isEnabled: boolean) => {
    const newState = updateAlwaysOnTop(isEnabled);
    setCustomizable(newState);
    try {
      await invoke("set_always_on_top", { enabled: isEnabled });
      loadData();
    } catch (error) {
      console.error("Failed to toggle always on top:", error);
    }
  };

  const toggleAutostart = async (isEnabled: boolean) => {
    const newState = updateAutostart(isEnabled);
    setCustomizable(newState);
    try {
      if (isEnabled) {
        await enable();
      } else {
        await disable();
      }
      loadData();
    } catch (error) {
      console.error("Failed to toggle autostart:", error);
      const revertedState = updateAutostart(!isEnabled);
      setCustomizable(revertedState);
    }
  };

  const setCursorType = (type: CursorType) => {
    setCustomizable((prev) => ({ ...prev, cursor: { type } }));
    updateCursor(type);
    updateCursorType(type);
    loadData();
  };

  // Create the context value (extend IContextType accordingly)
  const value: IContextType = {
    systemPrompt,
    setSystemPrompt,
    allAiProviders,
    customAiProviders,
    selectedAIProvider,
    onSetSelectedAIProvider,
    aiProviderConfigs,
    updateAiProviderConfig,
    removeAiProviderConfig,
    activateAiProvider,
    otherAiProviderId,
    setOtherAiProvider,
    voiceProviderConfigs,
    updateVoiceProviderConfig,
    activateVoiceProvider,
    otherVoiceProviderId,
    setOtherVoiceProvider,
    allSttProviders,
    customSttProviders,
    selectedSttProvider,
    onSetSelectedSttProvider,
    screenshotConfiguration,
    setScreenshotConfiguration,
    customizable,
    toggleAppIconVisibility,
    toggleAlwaysOnTop,
    toggleAutostart,
    loadData,
    selectedAudioDevices,
    setSelectedAudioDevices,
    setCursorType,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Create a hook to access the context
export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within a AppProvider");
  }

  return context;
};
