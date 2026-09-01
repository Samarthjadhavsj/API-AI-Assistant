import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceRecordingBar } from "@/pages/app/components/completion/VoiceRecordingBar";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { isUsableTranscript } from "@/lib/voice-recorder.utils";
import { voiceErrorMessage } from "@/lib/voice/errors";
import { SttResult } from "@/lib/voice/types";
import { useApp } from "@/contexts";

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

const MAX_DURATION = 3 * 60 * 1000;

/** Chat-specific presentation for the shared, complete-blob recorder lifecycle. */
export const AudioRecorder = ({
  onTranscriptionComplete,
  onCancel,
  onError,
}: AudioRecorderProps) => {
  const { selectedAudioDevices } = useApp();
  const [isSending, setIsSending] = useState(false);
  const startedRef = useRef(false);

  const handleResult = useCallback(
    (result: SttResult) => {
      setIsSending(false);
      if (!isUsableTranscript(result.text)) {
        onError?.("No speech was recognized. Please try again.");
        onCancel();
        return;
      }
      onTranscriptionComplete(result.text);
    },
    [onCancel, onError, onTranscriptionComplete]
  );

  const voice = useVoiceInput({
    maxDurationMs: MAX_DURATION,
    onResult: handleResult,
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void voice.start(selectedAudioDevices.input || undefined);
    // One session for this mounted recorder; cleanup is owner-scoped in useVoiceInput.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!voice.isActiveSessionOwner) return;
    if (voice.state !== "error" || !voice.error) return;
    onError?.(voice.error.message);
    onCancel();
  }, [onCancel, onError, voice.error, voice.isActiveSessionOwner, voice.state]);

  const handleStop = () => {
    voice.cancel();
    onCancel();
  };

  const handleSend = async () => {
    if (isSending || voice.state !== "recording") return;
    setIsSending(true);
    try {
      await voice.stop();
    } catch (error) {
      setIsSending(false);
      onError?.(voiceErrorMessage(error));
      onCancel();
    }
  };

  const isRecording = voice.state === "recording" || voice.state === "finalizing";
  const isInitializing = voice.state === "requestingPermission";
  const isTranscribing = voice.state === "transcribing" || isSending;

  return (
    <VoiceRecordingBar
      stream={voice.stream}
      durationMs={voice.durationMs}
      isInitializing={isInitializing}
      isRecording={isRecording}
      isTranscribing={isTranscribing}
      onCancel={handleStop}
      onConfirm={() => void handleSend()}
    />
  );
};
