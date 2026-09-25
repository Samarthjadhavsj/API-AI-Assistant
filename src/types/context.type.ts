import { Dispatch, SetStateAction } from "react";
import { ScreenshotConfig, TYPE_PROVIDER } from "@/types";
import { CursorType, CustomizableState } from "@/lib/storage";
import type { AiProviderConfigs, ProviderVariables } from "@/lib/provider-settings";

/** Per-provider AI settings; switching provider keeps every provider's values. */
export interface AiProviderSettingsContext {
  /** Each provider's saved variables (API key, model, …). */
  aiProviderConfigs: AiProviderConfigs;
  /** Saves a provider's settings; the active provider's are used right away. */
  updateAiProviderConfig: (provider: string, variables: ProviderVariables) => void;
  /** Forgets a provider's saved settings (e.g. a deleted custom endpoint's key). */
  removeAiProviderConfig: (provider: string) => void;
  /** Makes a provider answer questions, with its own saved settings. */
  activateAiProvider: (provider: string) => void;
  /** The provider shown under "Other AI providers". */
  otherAiProviderId: string;
  setOtherAiProvider: (provider: string) => void;
  /** Each voice provider's saved variables (Gemini Voice included). */
  voiceProviderConfigs: AiProviderConfigs;
  /** Saves a voice provider's settings; the active one's are used right away. */
  updateVoiceProviderConfig: (provider: string, variables: ProviderVariables) => void;
  /** Makes a provider transcribe voice input, with its own saved settings. */
  activateVoiceProvider: (provider: string) => void;
  /** The provider shown under "Other voice providers". */
  otherVoiceProviderId: string;
  setOtherVoiceProvider: (provider: string) => void;
}

export type IContextType = AiProviderSettingsContext & {
  systemPrompt: string;
  setSystemPrompt: Dispatch<SetStateAction<string>>;
  allAiProviders: TYPE_PROVIDER[];
  customAiProviders: TYPE_PROVIDER[];
  selectedAIProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  onSetSelectedAIProvider: ({
    provider,
    variables,
  }: {
    provider: string;
    variables: Record<string, string>;
  }) => void;
  allSttProviders: TYPE_PROVIDER[];
  customSttProviders: TYPE_PROVIDER[];
  selectedSttProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  onSetSelectedSttProvider: ({
    provider,
    variables,
  }: {
    provider: string;
    variables: Record<string, string>;
  }) => void;
  screenshotConfiguration: ScreenshotConfig;
  setScreenshotConfiguration: React.Dispatch<
    React.SetStateAction<ScreenshotConfig>
  >;
  customizable: CustomizableState;
  toggleAppIconVisibility: (isVisible: boolean) => Promise<void>;
  toggleAlwaysOnTop: (isEnabled: boolean) => Promise<void>;
  toggleAutostart: (isEnabled: boolean) => Promise<void>;
  loadData: () => void;
  selectedAudioDevices: {
    input: string;
    output: string;
  };
  setSelectedAudioDevices: Dispatch<
    SetStateAction<{
      input: string;
      output: string;
    }>
  >;
  setCursorType: (type: CursorType) => void;
};
