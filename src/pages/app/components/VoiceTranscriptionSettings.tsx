import { Button, Header, TextInput } from "@/components";
import { ApiKeyInput } from "@/components/ui/api-key-input";
import { UseSettingsReturn } from "@/types";
import { KeyIcon, TrashIcon } from "lucide-react";
import { GEMINI_TRANSCRIBE_MODEL } from "@/config/stt.constants";

export const VoiceTranscriptionSettings = ({
  selectedSttProvider,
  onSetSelectedSttProvider,
}: UseSettingsReturn) => {
  const getApiKeyValue = () => {
    return selectedSttProvider?.variables?.api_key || "";
  };

  const getModelValue = () => {
    return selectedSttProvider?.variables?.model || GEMINI_TRANSCRIBE_MODEL;
  };

  const isApiKeyEmpty = () => {
    return !getApiKeyValue().trim();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Header
          title="Gemini API Key"
          description="Enter your Gemini API key for voice transcription. Your key is stored locally and never shared."
        />

        <div className="space-y-2">
          <div className="flex gap-2">
            <ApiKeyInput
              value={getApiKeyValue()}
              onChange={(value) => {
                if (!selectedSttProvider) return;

                onSetSelectedSttProvider({
                  ...selectedSttProvider,
                  variables: {
                    ...selectedSttProvider.variables,
                    api_key: value,
                  },
                });
              }}
              className="h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
            />
            {isApiKeyEmpty() ? (
              <Button
                onClick={() => {
                  if (!selectedSttProvider || isApiKeyEmpty()) return;

                  onSetSelectedSttProvider({
                    ...selectedSttProvider,
                    variables: {
                      ...selectedSttProvider.variables,
                      api_key: getApiKeyValue(),
                    },
                  });
                }}
                disabled={isApiKeyEmpty()}
                size="icon"
                className="shrink-0 h-11 w-11"
                title="Submit API Key"
              >
                <KeyIcon className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (!selectedSttProvider) return;

                  onSetSelectedSttProvider({
                    ...selectedSttProvider,
                    variables: {
                      ...selectedSttProvider.variables,
                      api_key: "",
                    },
                  });
                }}
                size="icon"
                variant="destructive"
                className="shrink-0 h-11 w-11"
                title="Remove API Key"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Header
          title="Transcription Model"
          description="Choose the Gemini model for speech-to-text transcription."
        />
        <TextInput
          placeholder="Enter Gemini model (e.g., gemini-3.5-transcribe)"
          value={getModelValue()}
          onChange={(value) => {
            if (!selectedSttProvider) return;

            onSetSelectedSttProvider({
              ...selectedSttProvider,
              variables: {
                ...selectedSttProvider.variables,
                model: value,
              },
            });
          }}
        />
      </div>
    </div>
  );
};