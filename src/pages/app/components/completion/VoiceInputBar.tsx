import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXPANDED_WINDOW_HEIGHT,
  isAnyPopoverOpen,
  setNativeWindowHeight,
} from "@/hooks/useWindow";

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

const VOICE_WAVE = {
  /** Number of dots/bars in the scrolling wave. */
  POINTS: 12,
  /** A resting dot. */
  MIN_HEIGHT: 2,
  MAX_HEIGHT: 16,
  /** How often a new level enters on the right and the wave shifts left. */
  SAMPLE_MS: 80,
  /** Average FFT energy below which the room is treated as quiet. */
  QUIET_THRESHOLD: 2,
} as const;
export const MAX_TEXTAREA_HEIGHT = 160;
export const MIN_TEXTAREA_HEIGHT = 20;
export const BASE_WINDOW_HEIGHT = 54;
/** Card padding + border below the bar, so the window ends at the card's edge. */
const WINDOW_BOTTOM_GAP = 5;
export const MAX_VOICE_WINDOW_HEIGHT =
  BASE_WINDOW_HEIGHT + (MAX_TEXTAREA_HEIGHT - MIN_TEXTAREA_HEIGHT); // 194

export function calculateVoiceWindowHeight(textareaHeight: number): number {
  const clampedHeight = Math.max(
    MIN_TEXTAREA_HEIGHT,
    Math.min(textareaHeight, MAX_TEXTAREA_HEIGHT)
  );
  return BASE_WINDOW_HEIGHT + (clampedHeight - MIN_TEXTAREA_HEIGHT);
}

export type VoiceNoticeTone = "neutral" | "error";

/**
 * Turns controller/UI error text into a short, friendly line. "Nothing heard"
 * and setup hints are neutral; only real failures use the error tone.
 */
export function describeVoiceError(message?: string): { text: string; tone: VoiceNoticeTone } {
  const raw = (message ?? "").trim();
  if (/no speech|not recognized|no audio/i.test(raw)) {
    return { text: "Didn't catch that. Try again.", tone: "neutral" };
  }
  if (/api key/i.test(raw)) {
    return { text: "Add a Gemini API key in Settings → Voice Transcription.", tone: "neutral" };
  }
  if (/cancelled|canceled/i.test(raw)) {
    return { text: "Dictation cancelled.", tone: "neutral" };
  }
  if (/already active|already in use/i.test(raw)) {
    return { text: "Voice input is already in use.", tone: "neutral" };
  }
  if (/permission/i.test(raw)) {
    return { text: "Microphone access is blocked.", tone: "error" };
  }
  if (/another app/i.test(raw)) {
    return { text: "Microphone is in use by another app.", tone: "error" };
  }
  if (/microphone/i.test(raw)) {
    return { text: "Microphone unavailable.", tone: "error" };
  }
  if (raw && raw.length <= 48) return { text: raw, tone: "error" };
  return { text: "Couldn't transcribe. Try again.", tone: "error" };
}

const quietWave = () => Array<number>(VOICE_WAVE.POINTS).fill(VOICE_WAVE.MIN_HEIGHT);

/** Newest sample enters on the right; everything else moves one step left. */
export function pushWaveSample(wave: number[], height: number): number[] {
  return [...wave.slice(1), height];
}

const iconButton =
  "flex shrink-0 items-center justify-center outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring";
/** ✕ and ✓ share one soft rounded-square style. */
const sessionButton = cn(
  iconButton,
  "size-7 rounded-lg bg-foreground/10 text-foreground/80 hover:bg-foreground/15 hover:text-foreground",
  "disabled:pointer-events-none"
);

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
  const isListening = activeUiState === "listening";
  const isTranscribing = activeUiState === "processing";
  /** Listening or transcribing: the bar shows the spoken transcript. */
  const isVoiceSession = isListening || isTranscribing;

  const [wave, setWave] = useState<number[]>(quietWave);
  /** Latest wave height from the analyser; sampled into the wave on a timer. */
  const liveLevelRef = useRef<number>(VOICE_WAVE.MIN_HEIGHT);
  const barRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Keep the whole spoken transcript visible while it is being finalized.
  const displayValue = isVoiceSession && transcript !== undefined ? transcript : inputValue;

  const setTextareaRef = useCallback(
    (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      if (inputRef) {
        (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = element;
      }
    },
    [inputRef]
  );

  // Size the bar to the transcript during a voice session. Outside it the
  // window is owned by the popover logic, so only restore it once, when the
  // session ends (never on ordinary typing — that collapsed open popovers).
  const wasVoiceSessionRef = useRef(false);
  useEffect(() => {
    const textarea = textareaRef.current;

    if (isVoiceSession && textarea) {
      textarea.style.height = "auto";
      const height = Math.max(
        MIN_TEXTAREA_HEIGHT,
        Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)
      );
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
      // Always follow the newest words once the transcript scrolls.
      textarea.scrollTop = textarea.scrollHeight;
      // Fit the window to the rendered bar: idle size on one line, growing
      // downward with the transcript. Fall back to arithmetic when nothing is
      // laid out (e.g. tests).
      const barBottom = barRef.current?.getBoundingClientRect().bottom ?? 0;
      setNativeWindowHeight(
        barBottom > 0
          ? Math.max(BASE_WINDOW_HEIGHT, Math.ceil(barBottom) + WINDOW_BOTTOM_GAP)
          : calculateVoiceWindowHeight(height)
      );
    } else {
      if (textarea) {
        textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
        textarea.style.overflowY = "hidden";
      }
      if (wasVoiceSessionRef.current) {
        setNativeWindowHeight(
          isAnyPopoverOpen() ? EXPANDED_WINDOW_HEIGHT : BASE_WINDOW_HEIGHT
        );
      }
    }
    wasVoiceSessionRef.current = isVoiceSession;
  }, [displayValue, activeUiState, isVoiceSession]);

  useEffect(() => {
    return () => {
      setNativeWindowHeight(BASE_WINDOW_HEIGHT);
    };
  }, []);

  // While listening, Enter finishes and Escape cancels dictation wherever focus
  // is (the mic button unmounts on start, so focus usually lands on <body>).
  // Capture phase on window runs before React's handlers and before Radix's
  // document-level Escape listener, so neither the normal send handler nor the
  // response popover's dismiss/reset ever sees these keys.
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);
  onConfirmRef.current = onConfirm;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (activeUiState !== "listening") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        // Let IME composition commit its text; never treat that Enter as finish.
        if (event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        event.stopPropagation();
        // Shift+Enter is swallowed: no newline (read-only) and no send.
        if (!event.shiftKey) onConfirmRef.current();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeUiState]);

  // Return focus to the text box when voice mode ends (finish, cancel, error).
  const previousUiStateRef = useRef(activeUiState);
  useEffect(() => {
    const previous = previousUiStateRef.current;
    previousUiStateRef.current = activeUiState;
    if (activeUiState === "idle" && previous !== "idle") {
      textareaRef.current?.focus();
    }
  }, [activeUiState]);

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

  // Scroll the wave right → left while listening: every tick the newest level
  // enters on the right. Quiet input keeps it a row of resting dots.
  useEffect(() => {
    if (!isListening) {
      liveLevelRef.current = VOICE_WAVE.MIN_HEIGHT;
      setWave(quietWave());
      return;
    }
    const timer = setInterval(() => {
      setWave((previous) => pushWaveSample(previous, liveLevelRef.current));
    }, VOICE_WAVE.SAMPLE_MS);
    return () => clearInterval(timer);
  }, [isListening]);

  // Web Audio level analysis - ONLY active during 'listening' state
  useEffect(() => {
    if (!stream || activeUiState !== "listening") {
      cleanupAudio();
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
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;

          // Speech sits in the lower half of the spectrum; use its energy.
          const speechBins = Math.floor(dataArray.length / 2);
          let speechSum = 0;
          for (let i = 0; i < speechBins; i++) speechSum += dataArray[i];
          const level = Math.min(1, speechSum / speechBins / 128);

          liveLevelRef.current =
            average <= VOICE_WAVE.QUIET_THRESHOLD
              ? VOICE_WAVE.MIN_HEIGHT
              : Math.round(
                  VOICE_WAVE.MIN_HEIGHT + level * (VOICE_WAVE.MAX_HEIGHT - VOICE_WAVE.MIN_HEIGHT)
                );
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

  const notice = activeUiState === "error" ? describeVoiceError(errorMessage) : null;
  const statusText = isListening
    ? "Listening"
    : isTranscribing
    ? "Transcribing"
    : notice?.text ?? "";

  const renderTextarea = () => (
    <div className="flex min-w-0 flex-1 self-stretch py-1">
      <textarea
        ref={setTextareaRef}
        placeholder={
          isListening ? "Listening…" : isTranscribing ? "Transcribing…" : "Write a message…"
        }
        value={displayValue}
        onChange={(e) => onInputChange?.(e.target.value)}
        // Only the idle composer may send; during dictation the box mirrors
        // the live transcript and must not edit or submit the hidden draft.
        onKeyPress={activeUiState === "idle" ? onKeyPress : undefined}
        onPaste={onPaste}
        readOnly={isVoiceSession}
        disabled={disabled}
        rows={1}
        className={cn(
          "min-h-5 max-h-40 min-w-0 flex-1 resize-none border-none bg-transparent p-0",
          "text-sm leading-5 text-foreground placeholder:text-muted-foreground",
          "break-words focus:outline-none focus:ring-0",
          "transition-opacity duration-200 motion-reduce:transition-none",
          isVoiceSession && "placeholder:italic",
          isTranscribing && "opacity-60"
        )}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );

  const renderMicButton = () => (
    <button
      type="button"
      onClick={onMicClick}
      disabled={disabled}
      className={cn(
        iconButton,
        "size-7 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none",
        !isProviderConfigured && "opacity-50"
      )}
      title={
        isProviderConfigured
          ? "Start voice input"
          : "Configure API key in Settings to use voice input"
      }
      aria-label="Start voice input"
      data-testid="voice-mic-button"
    >
      <Mic className="size-4" />
    </button>
  );

  // Wave (or "Transcribing…") then ✕ ✓ on the same line as the transcript,
  // pinned to the bar's bottom-right so they stay put as the text grows down.
  // ✕/✓ are the same elements in both states, so they never move.
  const renderSessionControls = () => (
    <div
      className="flex h-7 shrink-0 items-center gap-1.5 self-end"
      data-testid="voice-controls"
    >
      <div className="flex w-[4.25rem] items-center justify-end" aria-hidden="true">
        {isListening ? (
          <span
            key="wave"
            className="flex h-5 items-center gap-[3px] duration-150 motion-safe:animate-in motion-safe:fade-in-0"
            data-testid="audio-visualization"
          >
            {wave.map((height, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-foreground/60 transition-[height] duration-75 ease-out motion-reduce:transition-none"
                style={{ height: `${height}px` }}
              />
            ))}
          </span>
        ) : (
          <span
            key="transcribing"
            className="whitespace-nowrap text-[11px] italic text-muted-foreground duration-150 motion-safe:animate-in motion-safe:fade-in-0"
          >
            Transcribing…
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
        disabled={isTranscribing}
        className={cn(sessionButton, "disabled:opacity-40")}
        title="Cancel dictation"
        aria-label="Cancel dictation"
      >
        <X className="size-4 pointer-events-none" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onConfirm();
        }}
        disabled={isTranscribing}
        aria-busy={isTranscribing || undefined}
        className={sessionButton}
        title="Finish dictation"
        aria-label="Finish dictation"
      >
        {isTranscribing ? (
          <Loader2
            key="spinner"
            className="size-4 pointer-events-none motion-safe:animate-spin"
            data-testid="voice-spinner"
          />
        ) : (
          <Check
            key="check"
            className="size-4 pointer-events-none duration-150 motion-safe:animate-in motion-safe:zoom-in-95"
          />
        )}
      </button>
    </div>
  );

  const renderNotice = () => (
    <div
      className={cn(
        "flex h-7 min-w-0 flex-1 items-center gap-2 text-sm duration-150 motion-safe:animate-in motion-safe:fade-in-0",
        notice?.tone === "error" ? "text-destructive" : "text-muted-foreground"
      )}
      data-testid="voice-notice"
      data-tone={notice?.tone}
    >
      {notice?.tone === "error" ? (
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <MicOff className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate select-none">{notice?.text}</span>
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      <span
        className="sr-only"
        role="status"
        aria-live={activeUiState === "error" ? "assertive" : "polite"}
      >
        {statusText}
      </span>
      <div
        ref={barRef}
        // Also marks transcribing so window-resize logic keeps the grown bar.
        data-voice-listening={isVoiceSession ? "true" : undefined}
        data-voice-state={activeUiState}
        className={cn(
          // Same compact bar in every state; dictation only grows it downward.
          "flex min-h-9 min-w-0 max-w-full items-start justify-between gap-2 rounded-2xl py-[3px] pl-4 pr-1",
          "border border-border bg-input/30",
          "transition-colors duration-200 motion-reduce:transition-none",
          notice?.tone === "error" && "border-destructive/40"
        )}
      >
        {activeUiState === "error" ? renderNotice() : renderTextarea()}
        {isVoiceSession ? (
          renderSessionControls()
        ) : (
          <div className="flex h-7 shrink-0 items-center">{renderMicButton()}</div>
        )}
      </div>
    </div>
  );
}
