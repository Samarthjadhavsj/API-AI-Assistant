import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, X, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { setNativeWindowHeight } from "@/hooks/useWindow";

export type VoiceUiState = "idle" | "listening" | "processing" | "error";
export type VoiceInputState = "idle" | "listening" | "active" | "processing" | "error";

export interface VoiceInputBarProps {
  state?: VoiceInputState;
  uiState?: VoiceUiState;
  transcript?: string;
  stream?: MediaStream | null;
  onMicClick: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  className?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  isProviderConfigured?: boolean;
  errorMessage?: string;
}

const ANIMATION_CONFIG = {
  DOT_COUNT: 15,
  AMPLITUDE_THRESHOLD: 2,
} as const;
export const MAX_TEXTAREA_HEIGHT = 160;
export const MIN_TEXTAREA_HEIGHT = 20;
export const BASE_WINDOW_HEIGHT = 54;
export const MAX_VOICE_WINDOW_HEIGHT =
  BASE_WINDOW_HEIGHT + (MAX_TEXTAREA_HEIGHT - MIN_TEXTAREA_HEIGHT); // 194

export function calculateVoiceWindowHeight(textareaHeight: number): number {
  const clampedHeight = Math.max(
    MIN_TEXTAREA_HEIGHT,
    Math.min(textareaHeight, MAX_TEXTAREA_HEIGHT)
  );
  return BASE_WINDOW_HEIGHT + (clampedHeight - MIN_TEXTAREA_HEIGHT);
}

export function VoiceInputBar({
  state,
  uiState,
  transcript,
  stream = null,
  onMicClick,
  onCancel,
  onConfirm,
  className,
  inputValue = "",
  onInputChange,
  inputRef,
  onKeyPress,
  onPaste,
  disabled = false,
  isProcessing = false,
  isProviderConfigured = true,
  errorMessage = "",
}: VoiceInputBarProps) {
  // Explicit UI state resolution: prefers uiState, falls back to processing/state mapping
  const activeUiState: VoiceUiState =
    uiState ??
    (isProcessing
      ? "processing"
      : state === "processing"
      ? "processing"
      : state === "error"
      ? "error"
      : state === "listening" || state === "active"
      ? "listening"
      : "idle");

  const [dotHeights, setDotHeights] = useState<number[]>(
    Array(ANIMATION_CONFIG.DOT_COUNT).fill(2)
  );
  const animationRef = useRef<number | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const displayValue = activeUiState === "listening" && transcript !== undefined
    ? transcript
    : inputValue;

  const setTextareaRef = useCallback(
    (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      if (inputRef) {
        (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = element;
      }
    },
    [inputRef]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (activeUiState === "listening") {
      textarea.style.height = "auto";
      const height = Math.max(
        MIN_TEXTAREA_HEIGHT,
        Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)
      );
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
      const targetWindowHeight = calculateVoiceWindowHeight(height);
      setNativeWindowHeight(targetWindowHeight);
    } else {
      textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
      textarea.style.overflowY = "hidden";
      setNativeWindowHeight(BASE_WINDOW_HEIGHT);
    }
  }, [displayValue, activeUiState]);

  useEffect(() => {
    return () => {
      setNativeWindowHeight(BASE_WINDOW_HEIGHT);
    };
  }, []);

  const cleanupAudio = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current
        .close()
        .catch((error) => console.error("[VoiceInputBar] Error closing AudioContext:", error));
    }

    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const cleanupStream = () => {
    const targetStream = streamRef.current;
    if (targetStream) {
      targetStream.getTracks().forEach((track) => {
        try {
          if (track.readyState !== "ended") {
            track.stop();
          }
        } catch (error) {
          console.error("[VoiceInputBar] Error stopping track", { id: track.id, error });
        }
      });
      streamRef.current = null;
    }
  };

  // Web Audio API setup for real-time audio analysis - ONLY active during 'listening' state
  useEffect(() => {
    if (!stream || activeUiState !== "listening") {
      cleanupAudio();
      setDotHeights(Array(ANIMATION_CONFIG.DOT_COUNT).fill(2));
      return;
    }

    streamRef.current = stream;

    const setupAudio = async () => {
      try {
        const activeTracks = stream
          .getTracks()
          .filter((t) => t.readyState === "live" && t.enabled);
        if (activeTracks.length === 0) return;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const analyze = () => {
          if (!analyserRef.current) return;

          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const isSpeaking = average > ANIMATION_CONFIG.AMPLITUDE_THRESHOLD;

          const heights: number[] = [];
          const step = Math.floor(dataArray.length / ANIMATION_CONFIG.DOT_COUNT);

          for (let i = 0; i < ANIMATION_CONFIG.DOT_COUNT; i++) {
            const dataIndex = i * step;
            const value = dataArray[dataIndex] !== undefined ? dataArray[dataIndex] : 0;

            if (isSpeaking) {
              const height = Math.max(2, Math.min(18, (value / 255) * 18));
              heights.push(height);
            } else {
              heights.push(2);
            }
          }

          setDotHeights(heights);
          animationRef.current = requestAnimationFrame(analyze);
        };

        analyze();
      } catch (error) {
        console.error("[VoiceInputBar] Error setting up audio analysis:", error);
      }
    };

    setupAudio();

    return () => {
      cleanupAudio();
      cleanupStream();
    };
  }, [stream, activeUiState]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      cleanupAudio();
      cleanupStream();
    };
  }, []);

  const renderTextarea = () => (
    <div className="flex items-center flex-1 min-w-0 self-stretch">
      <textarea
        ref={setTextareaRef}
        placeholder="Write a message…"
        value={displayValue}
        onChange={(e) => onInputChange?.(e.target.value)}
        onKeyPress={onKeyPress}
        onPaste={onPaste}
        disabled={disabled}
        rows={1}
        className="flex-1 min-w-0 min-h-5 max-h-40 border-none bg-transparent p-0 text-sm leading-5 text-white placeholder:text-white/60 resize-none focus:outline-none focus:ring-0"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );

  const renderIdleState = () => (
    <>
      {renderTextarea()}

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onMicClick}
          disabled={disabled}
          className={cn(
            "transition-colors p-1 rounded-md",
            isProviderConfigured
              ? "text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              : "text-white/40 cursor-not-allowed"
          )}
          title={
            isProviderConfigured
              ? "Voice input"
              : "Configure API key in Settings to use voice input"
          }
          aria-label="Voice input"
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  const renderListeningState = () => (
    <>
      {renderTextarea()}

      <div className="flex items-center gap-2 flex-shrink-0 self-center">
        <div className="flex items-center flex-shrink-0 h-5" data-testid="audio-visualization">
          <div className="flex items-center justify-center gap-[2px] overflow-hidden h-5 relative w-12">
            {dotHeights.map((height, i) => (
              <div
                key={i}
                className="absolute bg-neutral-300"
                style={{
                  width: "2px",
                  height: `${height}px`,
                  borderRadius: height > 4 ? "1px" : "50%",
                  animation: `flowRightToLeft 5s linear infinite`,
                  animationDelay: `${-i * 0.33}s`,
                  left: "50%",
                }}
              />
            ))}
          </div>
        </div>

        {/* Controls: Cancel (✕) and Finish (✓) */}
        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ pointerEvents: "auto" }}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirm();
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Finish"
            aria-label="Finish"
          >
            <Check className="w-4 h-4 pointer-events-none" />
          </button>
        </div>
      </div>
    </>
  );

  const renderProcessingState = () => (
    <div className="flex items-center flex-1 min-w-0 h-full">
      <span className="text-sm font-medium text-neutral-200 tracking-wide select-none">
        Processing...
      </span>
    </div>
  );

  const renderErrorState = () => (
    <div className="flex items-center justify-between w-full h-full text-red-400">
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-sm font-medium truncate select-none">
          {errorMessage || "Couldn't process voice"}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes flowRightToLeft {
          0% {
            transform: translateX(100px);
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            transform: translateX(-100px);
            opacity: 0;
          }
        }
      `}</style>
      <div className={cn("relative", className)}>
        <div
          data-voice-listening={activeUiState === "listening" ? "true" : undefined}
          className={cn(
            "flex items-center justify-between gap-3 px-5 py-2 rounded-2xl",
            "bg-[#1f1f1f] border border-[#363636]",
            "transition-all duration-200",
            "min-w-0",
            "max-w-full",
            "min-h-10",
            activeUiState === "error" && "border-red-500/50 bg-[#251a1a]"
          )}
        >
          {activeUiState === "idle" && renderIdleState()}
          {activeUiState === "listening" && renderListeningState()}
          {activeUiState === "processing" && renderProcessingState()}
          {activeUiState === "error" && renderErrorState()}
        </div>
      </div>
    </>
  );
}
