import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { Button } from "@/components";
import { AudioVisualizer } from "@/pages/app/components/speech/audio-visualizer";
import { formatRecordingDuration } from "@/lib/voice-recorder.utils";

interface VoiceRecordingBarProps {
  stream: MediaStream | null;
  durationMs: number;
  isInitializing: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Cursor-style composer chrome: waveform, timer, discard, confirm. */
export function VoiceRecordingBar({
  stream,
  durationMs,
  isInitializing,
  isRecording,
  isTranscribing,
  onCancel,
  onConfirm,
}: VoiceRecordingBarProps) {
  const confirmDisabled = !isRecording || isTranscribing || isInitializing;

  return (
    <div
      className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2"
      data-tauri-drag-region={false}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="min-w-0 flex-1">
        {stream && isRecording ? (
          <AudioVisualizer stream={stream} isRecording={isRecording} />
        ) : (
          <div className="flex h-8 items-center text-xs text-muted-foreground">
            {isTranscribing
              ? "Converting speech to text..."
              : isInitializing
                ? "Requesting microphone access..."
                : "Preparing microphone..."}
          </div>
        )}
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {formatRecordingDuration(durationMs)}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={onCancel}
        disabled={isInitializing}
        title="Discard recording"
        aria-label="Discard recording"
      >
        <XIcon className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        className="h-7 w-7"
        onClick={onConfirm}
        disabled={confirmDisabled}
        title={isTranscribing ? "Transcribing..." : "Insert transcript"}
        aria-label="Insert transcript"
      >
        {isTranscribing ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin" />
        ) : (
          <CheckIcon className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
