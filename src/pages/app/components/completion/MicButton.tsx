import { useVoiceInput } from "@/hooks/useVoiceInput";
import { MicIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components";
import { useApp } from "@/contexts";

const MAX_DURATION = 3 * 60 * 1000; // 3 minutes

/** Mic button with voice recording using useVoiceInput hook */
export const MicButton = () => {
  const { selectedAudioDevices, selectedSttProvider } = useApp();
  const isProviderConfigured = Boolean(selectedSttProvider.variables.api_key?.trim());

  const voice = useVoiceInput({
    maxDurationMs: MAX_DURATION,
    onResult: (result) => {
      console.log("Voice transcript received:", result.text);
      // TODO: Send transcript to AI in next step
    },
  });

  const handleMicClick = async () => {
    if (!isProviderConfigured) {
      console.warn("STT provider not configured");
      return;
    }

    if (voice.state === "recording" || voice.state === "finalizing") {
      await voice.stop();
    } else if (voice.state === "idle") {
      await voice.start(selectedAudioDevices.input || undefined);
    }
  };

  const isRecording = voice.state === "recording" || voice.state === "finalizing";
  const isTranscribing = voice.state === "transcribing";

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={handleMicClick}
      disabled={!isProviderConfigured || isTranscribing}
      className="size-7 lg:size-9 rounded-lg lg:rounded-xl"
      title={isRecording ? "Stop recording" : "Voice input"}
    >
      {isRecording ? (
        <SquareIcon className="size-3 lg:size-4 text-red-500" />
      ) : (
        <MicIcon className="size-3 lg:size-4" />
      )}
    </Button>
  );
};