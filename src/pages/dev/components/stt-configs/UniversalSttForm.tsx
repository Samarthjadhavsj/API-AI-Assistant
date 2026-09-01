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

  useEffect(() => {
    if (
      selectedSttProvider.provider === GEMINI_TRANSCRIBE_PROVIDER_ID &&
      selectedSttProvider.variables.model === GEMINI_TRANSCRIBE_MODEL
    ) {
      return;
    }

    onSetSelectedSttProvider({
      provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
      variables: {
        api_key: apiKey,
        model: GEMINI_TRANSCRIBE_MODEL,
      },
    });
  }, [
    apiKey,
    onSetSelectedSttProvider,
    selectedSttProvider.provider,
    selectedSttProvider.variables.model,
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
