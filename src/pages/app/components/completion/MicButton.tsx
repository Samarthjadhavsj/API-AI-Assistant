import { useEffect } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { MicIcon, SquareIcon, Loader2 } from "lucide-react";
import { Button } from "@/components";
import { useApp } from "@/contexts";

const MAX_DURATION = 3 * 60 * 1000; // 3 minutes

interface MicButtonProps {
  setInput: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isLoading?: boolean;
  onError?: (error: string) => void;
}

/** Mic button with voice recording using useVoiceInput hook */
export const MicButton = ({ setInput, inputRef, isLoading, onError }: MicButtonProps) => {
  const { selectedAudioDevices, selectedSttProvider } = useApp();
  const isProviderConfigured = Boolean(selectedSttProvider.variables.api_key?.trim());

  const voice = useVoiceInput({
    maxDurationMs: MAX_DURATION,
    onResult: (result) => {
      // Insert transcribed text into input field for user review/edit
      const transcript = result.text.trim();
      if (transcript) {
        setInput(transcript);
        // Focus input field after transcription
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    },
  });

  // Handle voice errors
  useEffect(() => {
    if (voice.state === "error" && voice.error && onError) {
      onError(voice.error.message);
    }
  }, [voice.state, voice.error, onError]);

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
  const hasError = voice.state === "error";

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={handleMicClick}
      disabled={!isProviderConfigured || isTranscribing || isLoading}
      className="size-7 lg:size-9 rounded-lg lg:rounded-xl"
      title={
        hasError
          ? "Voice input error - try again"
          : isTranscribing
          ? "Transcribing..."
          : isRecording
          ? "Stop recording"
          : "Voice input"
      }
    >
      {isTranscribing ? (
        <Loader2 className="size-3 lg:size-4 animate-spin text-muted-foreground" />
      ) : isRecording ? (
        <SquareIcon className="size-3 lg:size-4 text-red-500" />
      ) : hasError ? (
        <MicIcon className="size-3 lg:size-4 text-destructive" />
      ) : (
        <MicIcon className="size-3 lg:size-4" />
      )}
    </Button>
  );
};