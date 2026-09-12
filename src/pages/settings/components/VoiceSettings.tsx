import { useState } from "react";
import { Header, Button, Label, Selection } from "@/components";
import { ApiKeyInput } from "@/components/ui/api-key-input";
import { useApp } from "@/contexts";
import { GEMINI_TRANSCRIBE_PROVIDER_ID, GEMINI_TRANSCRIBE_MODEL } from "@/config/stt.constants";
import { CheckCircle2, AlertCircle, KeyIcon, Sparkles } from "lucide-react";

interface VoiceSettingsProps {
  className?: string;
}

export const VoiceSettings = ({ className }: VoiceSettingsProps) => {
  const {
    selectedSttProvider,
    onSetSelectedSttProvider,
    allSttProviders,
    selectedAIProvider,
  } = useApp();

  const currentApiKey = selectedSttProvider?.variables?.api_key || "";
  const [inputKey, setInputKey] = useState(currentApiKey);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isConfigured = Boolean(currentApiKey.trim());

  // Check if AI provider has a Gemini key we can copy
  const aiProviderKey =
    selectedAIProvider?.variables?.api_key &&
    (selectedAIProvider.provider === "gemini" ||
      selectedAIProvider.provider === "google" ||
      selectedAIProvider.provider === GEMINI_TRANSCRIBE_PROVIDER_ID)
      ? selectedAIProvider.variables.api_key
      : "";

  const handleSaveKey = (keyToSave?: string) => {
    const key = (keyToSave !== undefined ? keyToSave : inputKey).trim();
    onSetSelectedSttProvider({
      provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
      variables: {
        api_key: key,
        model: GEMINI_TRANSCRIBE_MODEL,
      },
    });
    setInputKey(key);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleClearKey = () => {
    onSetSelectedSttProvider({
      provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
      variables: {
        api_key: "",
        model: GEMINI_TRANSCRIBE_MODEL,
      },
    });
    setInputKey("");
  };

  const handleUseAiKey = () => {
    if (aiProviderKey) {
      handleSaveKey(aiProviderKey);
    }
  };

  return (
    <div id="voice-settings" className={`space-y-4 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <Header
          title="Speech-to-Text (Voice Input)"
          description="Configure your speech recognition provider for microphone input and voice transcription"
          isMainTitle
        />
        {isConfigured ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Configured
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-3.5 w-3.5" />
            API Key Required
          </span>
        )}
      </div>

      {/* Provider Selector */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">STT Provider</Label>
        <Selection
          selected={selectedSttProvider?.provider || GEMINI_TRANSCRIBE_PROVIDER_ID}
          onChange={(val: string) => {
            onSetSelectedSttProvider({
              provider: val,
              variables: {
                api_key: currentApiKey,
                model: GEMINI_TRANSCRIBE_MODEL,
              },
            });
          }}
          options={
            allSttProviders && allSttProviders.length > 0
              ? allSttProviders.map((p) => ({
                  value: p.id || "",
                  label: p.name || p.id || "STT Provider",
                }))
              : [
                  {
                    value: GEMINI_TRANSCRIBE_PROVIDER_ID,
                    label: "Gemini Transcription",
                  },
                ]
          }
        />
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Gemini API Key</Label>
          {aiProviderKey && aiProviderKey !== currentApiKey && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUseAiKey}
              className="h-7 text-xs text-primary gap-1 px-2"
              title="Copy key from AI Provider"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Use AI Provider Key
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <ApiKeyInput
              value={inputKey}
              onChange={setInputKey}
              placeholder="Enter your Gemini API key (AIza...)"
              className="h-10"
            />
          </div>
          <Button
            type="button"
            onClick={() => handleSaveKey()}
            disabled={!inputKey.trim() || inputKey === currentApiKey}
            size="sm"
            className="h-10 px-4"
          >
            {saveSuccess ? (
              <span className="flex items-center gap-1.5 text-xs text-white">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs">
                <KeyIcon className="h-4 w-4" /> Save
              </span>
            )}
          </Button>
          {isConfigured && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearKey}
              className="h-10 px-3 text-xs text-destructive hover:bg-destructive/10"
              title="Remove stored API key"
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Voice input uses Gemini's batch transcription API. Your API key is stored locally and never sent to any intermediary server.
        </p>
      </div>
    </div>
  );
};
