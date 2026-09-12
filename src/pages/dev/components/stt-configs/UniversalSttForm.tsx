import { Header, Input } from "@/components";
import {
  GEMINI_TRANSCRIBE_MODEL,
  GEMINI_TRANSCRIBE_PROVIDER_ID,
} from "@/config/stt.constants";
import { UseSettingsReturn } from "@/types";
import { useEffect } from "react";

/** Single-purpose setup for the app's Gemini-only transcription workflow. */
export const UniversalSttForm = ({
  selectedSttProvider,
  onSetSelectedSttProvider,
}: UseSettingsReturn) => {
  const apiKey = selectedSttProvider.variables.api_key || "";

  // Ensure the provider is set to Gemini, but don't reset the API key
  useEffect(() => {
    // Only reset if provider or model is wrong, but preserve the existing API key
    if (
      selectedSttProvider.provider === GEMINI_TRANSCRIBE_PROVIDER_ID &&
      selectedSttProvider.variables.model === GEMINI_TRANSCRIBE_MODEL
    ) {
      return; // Already correctly configured
    }

    console.log("[UniversalSttForm] Migrating to Gemini provider, preserving API key");
    onSetSelectedSttProvider({
      provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
      variables: {
        api_key: selectedSttProvider.variables.api_key || "", // Preserve existing API key
        model: GEMINI_TRANSCRIBE_MODEL,
      },
    });
  }, [
    // Removed apiKey from dependencies to prevent infinite loop
    onSetSelectedSttProvider,
    selectedSttProvider.provider,
    selectedSttProvider.variables.model,
    selectedSttProvider.variables.api_key, // Only depend on the actual stored value
  ]);

  return (
    <div className="space-y-3">
      <Header
        title="Gemini transcription"
        description="Voice clips are recorded locally, then transcribed by Gemini when you confirm."
        isMainTitle
      />

      <div className="space-y-1">
        <Header
          title="Gemini API key"
          description="Create a key in Google AI Studio and paste only the key value. It stays on this device."
        />
        <Input
          type="password"
          value={apiKey}
          placeholder="Paste your Gemini API key"
          onChange={(event) =>
            onSetSelectedSttProvider({
              provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
              variables: {
                api_key: event.target.value,
                model: GEMINI_TRANSCRIBE_MODEL,
              },
            })
          }
          className="h-11"
        />
      </div>

      <div className="space-y-1">
        <Header
          title="STT model"
          description="Voice recordings use this dedicated Gemini batch-transcription model."
        />
        <Input
          aria-label="Speech-to-text model"
          className="h-11 text-muted-foreground"
          readOnly
          value={GEMINI_TRANSCRIBE_MODEL}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        The transcription model is managed by the app; no endpoint or model configuration is required.
      </p>
    </div>
  );
};
