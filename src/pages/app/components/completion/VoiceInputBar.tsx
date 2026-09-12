import { useEffect, useRef, useState } from "react";
import { Plus, Mic, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceInputState = "idle" | "listening" | "active";

interface VoiceInputBarProps {
  state: VoiceInputState;
  transcript?: string;
  stream?: MediaStream | null;
  onMicClick: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  className?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  disabled?: boolean;
}

const ANIMATION_CONFIG = {
  DOT_COUNT: 15,
  DOT_SIZE: 2,
  DOT_SPACING: 4,
  AMPLITUDE_THRESHOLD: 2, // Very low threshold for more responsive speech detection
} as const;

export function VoiceInputBar({
  state,
  transcript = "",
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
}: VoiceInputBarProps) {
  const [isAboveThreshold, setIsAboveThreshold] = useState(false);
  const [dotHeights, setDotHeights] = useState<number[]>(Array(ANIMATION_CONFIG.DOT_COUNT).fill(2));
  const animationRef = useRef<number | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Web Audio API setup for real-time audio analysis
  useEffect(() => {
    if (!stream || state === "idle") {
      cleanupAudio();
      return;
    }

    // Update stream ref
    streamRef.current = stream;

    const setupAudio = async () => {
      try {
        console.log("[VoiceInputBar] Setting up audio analysis", {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          tracks: stream.getTracks().map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState }))
        });

        // Verify stream is active before proceeding
        const activeTracks = stream.getTracks().filter(t => t.readyState === 'live' && t.enabled);
        if (activeTracks.length === 0) {
          console.error("[VoiceInputBar] No active tracks in stream", {
            allTracks: stream.getTracks().map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState, enabled: t.enabled }))
          });
          return;
        }

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        if (audioContext.state === "suspended") {
          console.log("[VoiceInputBar] AudioContext suspended, resuming...");
          await audioContext.resume();
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        console.log("[VoiceInputBar] Audio analysis setup complete", {
          contextState: audioContext.state,
          fftSize: analyser.fftSize,
          sampleRate: audioContext.sampleRate,
          activeTracks: activeTracks.length
        });

        startAudioAnalysis();
      } catch (error) {
        console.error("[VoiceInputBar] Error setting up audio analysis:", error);
      }
    };

    setupAudio();

    return () => {
      cleanupAudio();
      cleanupStream();
    };
  }, [stream, state]);

  const cleanupAudio = () => {
    console.log("[VoiceInputBar] Cleaning up audio resources", {
      hasAnimationFrame: !!animationRef.current,
      hasAudioContext: !!audioContextRef.current,
      audioContextState: audioContextRef.current?.state
    });

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
        .then(() => console.log("[VoiceInputBar] AudioContext closed successfully"))
        .catch((error) => console.error("[VoiceInputBar] Error closing AudioContext:", error));
    }

    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const cleanupStream = () => {
    const targetStream = streamRef.current;
    if (targetStream) {
      console.log("[VoiceInputBar] Cleaning up media stream tracks", {
        trackCount: targetStream.getTracks().length,
        tracks: targetStream.getTracks().map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState }))
      });

      targetStream.getTracks().forEach((track) => {
        try {
          if (track.readyState !== 'ended') {
            console.log("[VoiceInputBar] Stopping track", { id: track.id, kind: track.kind, readyState: track.readyState });
            track.stop();
            console.log("[VoiceInputBar] Track stopped successfully", { id: track.id, newState: track.readyState });
          } else {
            console.log("[VoiceInputBar] Track already ended", { id: track.id });
          }
        } catch (error) {
          console.error("[VoiceInputBar] Error stopping track", { id: track.id, error });
        }
      });

      streamRef.current = null;
    }
  };

  const startAudioAnalysis = () => {
    const analyze = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average amplitude
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;

      const isSpeaking = average > ANIMATION_CONFIG.AMPLITUDE_THRESHOLD;
      setIsAboveThreshold(isSpeaking);

      // Update animation time for flow effect
      animationTimeRef.current += 0.05;

      // Generate individual dot heights based on frequency data
      const heights = [];
      const step = Math.floor(dataArray.length / ANIMATION_CONFIG.DOT_COUNT);
      
      for (let i = 0; i < ANIMATION_CONFIG.DOT_COUNT; i++) {
        const dataIndex = i * step;
        const value = dataArray[dataIndex] !== undefined ? dataArray[dataIndex] : 0;
        
        if (isSpeaking) {
          // When speaking, transform dots to bars based on frequency
          // Create a wave-like pattern with consistent bar widths
          const height = Math.max(2, Math.min(18, (value / 255) * 18));
          heights.push(height);
        } else {
          // When listening (no speech), keep as small dots
          heights.push(2);
        }
      }
      
      setDotHeights(heights);

      animationRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  // Determine effective state (listening vs active based on audio threshold)
  const effectiveState = state === "listening" && isAboveThreshold ? "active" : state;

  // Reset dot heights when not recording or when in listening state without speech
  useEffect(() => {
    if (state === "idle") {
      setDotHeights(Array(ANIMATION_CONFIG.DOT_COUNT).fill(2));
    }
    // Don't reset when listening - let the audio analysis handle it
  }, [state]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      console.log("[VoiceInputBar] Component unmounting, performing final cleanup");
      cleanupAudio();
      cleanupStream();
    };
  }, []);

  const renderIdleState = () => (
    <>
      {/* Left side */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Plus button functionality could be added here
          }}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          placeholder="Write a message…"
          value={inputValue}
          onChange={(e) => onInputChange?.(e.target.value)}
          onKeyPress={onKeyPress}
          onPaste={onPaste}
          disabled={disabled}
          className="flex-1 min-w-0 border-none bg-transparent p-0 h-5 text-sm text-gray-400 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      {/* Right side - only mic icon */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onMicClick}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  const renderListeningState = () => (
    <>
      {/* Left side */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Plus button functionality could be added here
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <span className="text-gray-400 text-sm italic h-5 flex items-center">Listening…</span>
      </div>

      {/* Animated dots flowing from right to left - slowly */}
      <div className="flex items-center justify-center gap-[2px] overflow-hidden h-5 relative w-32">
        {dotHeights.map((height, i) => (
          <div
            key={i}
            className="absolute bg-gray-400"
            style={{
              width: '2px',
              height: `${height}px`,
              borderRadius: height > 4 ? '1px' : '50%',
              animation: `flowRightToLeft 5s linear infinite`,
              animationDelay: `${-i * 0.33}s`,
              left: '50%',
            }}
          />
        ))}
      </div>

      {/* Cancel and confirm buttons - rounded squares */}
      <div className="flex items-center gap-1" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Cancel button clicked");
            onCancel();
          }}
          className="w-7 h-7 rounded flex items-center justify-center bg-[#4a4a4a] hover:bg-[#5a5a5a] text-white transition-colors cursor-pointer"
          type="button"
        >
          <X className="w-4 h-4 pointer-events-none" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Confirm button clicked");
            onConfirm();
          }}
          className="w-7 h-7 rounded flex items-center justify-center bg-[#4a4a4a] hover:bg-[#5a5a5a] text-white transition-colors cursor-pointer"
          type="button"
        >
          <Check className="w-4 h-4 pointer-events-none" />
        </button>
      </div>
    </>
  );

  const renderActiveState = () => (
    <>
      {/* Left side with transcript */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Plus button functionality could be added here
          }}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
        <span className="text-gray-400 text-sm italic truncate h-5 flex items-center">
          {transcript || "Hey,"}
        </span>
      </div>

      {/* Dots transformed into bars based on audio frequency, flowing right to left */}
      <div className="flex items-center justify-center gap-[2px] overflow-hidden h-5 relative w-32">
        {dotHeights.map((height, i) => (
          <div
            key={i}
            className="absolute bg-gray-400"
            style={{
              width: '2px',
              height: `${height}px`,
              borderRadius: height > 4 ? '1px' : '50%',
              animation: `flowRightToLeft 5s linear infinite`,
              animationDelay: `${-i * 0.33}s`,
              left: '50%',
            }}
          />
        ))}
      </div>

      {/* Cancel and confirm buttons - rounded squares */}
      <div className="flex items-center gap-1 flex-shrink-0" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Cancel button clicked (active)");
            onCancel();
          }}
          className="w-7 h-7 rounded flex items-center justify-center bg-[#4a4a4a] hover:bg-[#5a5a5a] text-white transition-colors cursor-pointer"
          type="button"
        >
          <X className="w-4 h-4 pointer-events-none" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Confirm button clicked (active)");
            onConfirm();
          }}
          className="w-7 h-7 rounded flex items-center justify-center bg-[#4a4a4a] hover:bg-[#5a5a5a] text-white transition-colors cursor-pointer"
          type="button"
        >
          <Check className="w-4 h-4 pointer-events-none" />
        </button>
      </div>
    </>
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
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 rounded-xl",
          "bg-[#2a2a2a] border border-[#3a3a3a]",
          "transition-all duration-200",
          "min-w-0",
          "max-w-full",
          "h-10",
          className
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {effectiveState === "idle" && renderIdleState()}
        {effectiveState === "listening" && renderListeningState()}
        {effectiveState === "active" && renderActiveState()}
      </div>
    </>
  );
}
