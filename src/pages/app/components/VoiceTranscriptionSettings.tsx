import { UseSettingsReturn } from "@/types";
import {
  GEMINI_TRANSCRIBE_LIVE_MODEL,
  GEMINI_TRANSCRIBE_PROVIDER_ID,
} from "@/config/stt.constants";
import { findGeminiModel, GEMINI_VOICE_MODELS } from "@/config/gemini-models.constants";
import { findVoiceProvider } from "@/config/voice-providers.constants";
import { GeminiVoiceSettings } from "./gemini/GeminiSettingsSections";
import { OtherVoiceProvidersSection } from "./gemini/OtherProviderSections";

/** Which provider transcribes voice input right now, in one line. */
const ActiveVoiceSummary = ({ selection }: { selection: UseSettingsReturn["selectedSttProvider"] }) => {
  const isGemini = selection.provider === GEMINI_TRANSCRIBE_PROVIDER_ID;
  const definition = isGemini ? null : findVoiceProvider(selection.provider);
  const name = isGemini
    ? "Gemini Voice"
    : definition?.id === "custom"
      ? selection.variables.name?.trim() || "Custom"
      : definition?.name ?? selection.provider;
  const model = selection.variables.model?.trim();
  const modelLabel = isGemini ? findGeminiModel(GEMINI_VOICE_MODELS, model)?.name ?? model : model;
  return (
    <p className="text-xs text-muted-foreground" role="status" data-testid="active-voice-provider">
      Transcribing with <span className="font-medium text-foreground">{name}</span>
      {modelLabel ? <> · {modelLabel}</> : null}
    </p>
  );
};

/**
 * Voice settings only: the built-in Gemini Voice, then another speech-to-text
 * provider set up by hand. Each keeps its own settings; "Use …" chooses which
 * one voice input uses.
 */
export const VoiceTranscriptionSettings = ({
  selectedSttProvider,
  voiceProviderConfigs,
  updateVoiceProviderConfig,
  activateVoiceProvider,
  otherVoiceProviderId,
  setOtherVoiceProvider,
}: UseSettingsReturn) => (
  <div className="space-y-4">
    <ActiveVoiceSummary selection={selectedSttProvider} />
    <GeminiVoiceSettings
      variables={
        voiceProviderConfigs[GEMINI_TRANSCRIBE_PROVIDER_ID] ?? { api_key: "", model: GEMINI_TRANSCRIBE_LIVE_MODEL }
      }
      onChange={(variables) => updateVoiceProviderConfig(GEMINI_TRANSCRIBE_PROVIDER_ID, variables)}
      isActive={selectedSttProvider.provider === GEMINI_TRANSCRIBE_PROVIDER_ID}
      onActivate={() => activateVoiceProvider(GEMINI_TRANSCRIBE_PROVIDER_ID)}
    />
    <OtherVoiceProvidersSection
      configs={voiceProviderConfigs}
      otherProviderId={otherVoiceProviderId}
      activeProviderId={selectedSttProvider.provider}
      onSelectProvider={setOtherVoiceProvider}
      onChangeConfig={updateVoiceProviderConfig}
      onActivate={activateVoiceProvider}
    />
  </div>
);
