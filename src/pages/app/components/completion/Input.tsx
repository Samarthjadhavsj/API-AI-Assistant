import { Loader2, XIcon } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  Button,
  ScrollArea,
  Markdown,
  Switch,
  CopyButton,
} from "@/components";
import { TransparentPopoverContent } from "@/components/ui/popover";
import { UseCompletionReturn } from "@/types";
import type { ChatMessage } from "@/types/completion";
import { MessageHistory } from "./MessageHistory";
import { VoiceInputBar, VoiceUiState } from "./VoiceInputBar";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useApp } from "@/contexts";
import { invoke } from "@tauri-apps/api/core";
import { voiceErrorMessage } from "@/lib/voice/errors";

export const Input = ({
  isPopoverOpen,
  isLoading,
  reset,
  input,
  setInput,
  handleKeyPress,
  handlePaste,
  currentConversationId,
  conversationHistory,
  pendingMessage,
  startNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
  error,
  response,
  cancel,
  scrollAreaRef,
  inputRef,
  isHidden,
  keepEngaged,
  setKeepEngaged,
  onVoiceStateChange,
  trailingControls,
}: UseCompletionReturn & {
  isHidden: boolean;
  onVoiceStateChange?: (state: string) => void;
  /** Composer controls (Screenshot, Attach) rendered at the end of the input bar. */
  trailingControls?: ReactNode;
}) => {
  const [voiceUiState, setVoiceUiState] = useState<VoiceUiState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceLiveTranscript, setVoiceLiveTranscript] = useState("");
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const [voiceError, setVoiceError] = useState<string>("");
  const { selectedAudioDevices, selectedSttProvider } = useApp();
  const isProviderConfigured = Boolean(selectedSttProvider.variables.api_key?.trim());

  const voice = useVoiceInput({
    maxDurationMs: 3 * 60 * 1000,
    onPartial: (transcript) => {
      setVoiceLiveTranscript(transcript);
    },
    onResult: (result) => {
      const transcript = result.text.trim();
      if (transcript) {
        setVoiceTranscript(transcript);
      }
    },
  });

  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const voiceUiStateRef = useRef(voiceUiState);
  voiceUiStateRef.current = voiceUiState;
  const voiceActionRef = useRef<"idle" | "canceling" | "confirming">("idle");
  const startPromiseRef = useRef<Promise<boolean> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearErrorTimer = () => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  };

  const triggerVoiceError = (message = "Couldn't process voice") => {
    setVoiceError(message);
    setVoiceUiState("error");
    clearErrorTimer();
    errorTimeoutRef.current = setTimeout(() => {
      setVoiceUiState("idle");
      setVoiceError("");
    }, 2000);
  };

  const handleMicClick = async () => {
    if (voiceUiState === "processing" || voiceActionRef.current !== "idle") return;
    clearErrorTimer();

    if (!isProviderConfigured) {
      console.warn("[VoiceInput] STT provider not configured");
      triggerVoiceError("Voice input requires a Gemini API key. Add one in Settings → Voice Settings.");
      return;
    }

    if (voiceUiState === "listening") {
      handleVoiceCancel();
      return;
    }

    try {
      await invoke("set_recording_state", { recording: true });
    } catch (error) {
      console.error("[VoiceInput] Failed to set recording state:", error);
    }

    setVoiceUiState("listening");
    setVoiceLiveTranscript("");

    let startPromise: Promise<boolean> | null = null;
    try {
      startPromise = voice.start(selectedAudioDevices.input || undefined);
      startPromiseRef.current = startPromise;
      const startResult = await startPromise;
      if (!startResult) {
        throw new Error("Failed to start voice recording");
      }
    } catch (error) {
      console.error("[VoiceInput] Failed to start voice recording:", error);
      try {
        await invoke("set_recording_state", { recording: false });
      } catch (clearError) {
        console.error("[VoiceInput] Failed to clear recording state:", clearError);
      }
      triggerVoiceError(voiceErrorMessage(error) || "Couldn't process voice");
    } finally {
      if (startPromiseRef.current === startPromise) {
        startPromiseRef.current = null;
      }
    }
  };

  const handleVoiceCancel = async () => {
    if (voiceUiState === "processing" || voiceActionRef.current !== "idle") return;
    voiceActionRef.current = "canceling";
    clearErrorTimer();

    try {
      voiceRef.current.cancel();
    } finally {
      setVoiceUiState("idle");
      setVoiceTranscript("");
      setVoiceLiveTranscript("");
      setVoiceStream(null);
      setVoiceError("");

      try {
        await invoke("set_recording_state", { recording: false });
      } catch (error) {
        console.error("[VoiceInput] Failed to clear recording state:", error);
      } finally {
        voiceActionRef.current = "idle";
      }
    }
  };

  const handleVoiceConfirm = async () => {
    if (voiceActionRef.current !== "idle" || voiceUiState === "processing") return;
    voiceActionRef.current = "confirming";
    clearErrorTimer();

    // Immediately stop accepting new audio input and transition to processing
    setVoiceUiState("processing");

    try {
      const pendingStart = startPromiseRef.current;
      if (voiceRef.current.state === "requestingPermission" && pendingStart) {
        const started = await pendingStart;
        if (!started) {
          triggerVoiceError("Couldn't process voice");
          return;
        }
      }

      const result = await voiceRef.current.stop();
      const transcript = result?.text.trim();
      if (transcript) {
        setInput(transcript);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
      setVoiceUiState("idle");
      setVoiceTranscript("");
      setVoiceLiveTranscript("");
      setVoiceStream(null);
    } catch (error) {
      console.error("[VoiceInput] Error stopping voice recording:", error);
      triggerVoiceError(voiceErrorMessage(error) || "Couldn't process voice");
    } finally {
      try {
        await invoke("set_recording_state", { recording: false });
      } catch (clearError) {
        console.error("[VoiceInput] Failed to clear recording state:", clearError);
      } finally {
        voiceActionRef.current = "idle";
      }
    }
  };

  // Sync voice stream when recording
  useEffect(() => {
    if (voice.state === "recording" && voice.stream) {
      setVoiceStream(voice.stream);
    } else {
      setVoiceStream(null);
    }
  }, [voice.state, voice.stream]);

  // Reset to idle when voice controller becomes idle externally, unless in processing or error
  useEffect(() => {
    if (voice.state === "idle" && voiceUiState === "listening") {
      setVoiceUiState("idle");
      setVoiceTranscript("");
      setVoiceLiveTranscript("");
      setVoiceStream(null);
    }
  }, [voice.state, voiceUiState]);

  // Notify parent of voice state changes
  useEffect(() => {
    onVoiceStateChange?.(voiceUiState);
  }, [voiceUiState, onVoiceStateChange]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      clearErrorTimer();
      const currentVoice = voiceRef.current;
      if (voiceUiStateRef.current !== "idle" || currentVoice.state !== "idle") {
        currentVoice.cancel();
        invoke("set_recording_state", { recording: false }).catch((error) => {
          console.error("[VoiceInput] Failed to clear recording state on unmount:", error);
        });
      }
      if (currentVoice.stream) {
        currentVoice.stream.getTracks().forEach((track) => {
          try {
            if (track.readyState !== "ended") {
              track.stop();
            }
          } catch (error) {
            console.error("[VoiceInput] Error stopping track on unmount:", error);
          }
        });
      }
    };
  }, []);

  // Conversation mode reads top → bottom, oldest → newest. Sort a copy: sorting
  // the state array in place would reorder the history sent to the AI.
  const chronologicalHistory = useMemo(
    () => [...conversationHistory].sort((a, b) => a.timestamp - b.timestamp),
    [conversationHistory]
  );

  // The response panel is opened by completion state, never by clicking, so the
  // input bar only anchors its position. Using the bar as a PopoverTrigger made
  // every click in it (input, Message History, attachments) toggle the panel
  // closed, which resets the response, input and attachments.
  const inputBarRef = useRef<HTMLDivElement>(null);

  // Interacting with the input bar and its controls (Message History,
  // Screenshot, Attach), or with another floating layer opened from it, is not
  // a request to dismiss the response. Escape and interactions elsewhere still
  // close it as before.
  const keepResponseOpenOnInteraction: ComponentProps<
    typeof TransparentPopoverContent
  >["onInteractOutside"] = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      inputBarRef.current?.contains(target) ||
      target.closest("[data-radix-popper-content-wrapper]")
    ) {
      event.preventDefault();
    }
  };

  const renderThreadMessage = (message: ChatMessage) => (
    <div
      key={message.id}
      className={`p-3 rounded-lg text-sm ${message.role === "user" ? "border-l-4 border-primary" : ""}`}
      data-role={message.role}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {message.role === "user" ? "You" : "AI"}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <Markdown>{message.content}</Markdown>
      {message.attachedFiles && message.attachedFiles.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground break-words" data-testid="message-attachments">
          Attached: {message.attachedFiles.map((file) => file.name).join(", ")}
        </p>
      )}
    </div>
  );

  const renderGenerating = () => (
    <div className="flex items-center gap-2 my-4 text-muted-foreground animate-pulse select-none">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Generating response...</span>
    </div>
  );

  const renderError = () => (
    <div className="mb-4 p-3 border border-destructive/20 rounded text-sm text-destructive">
      <strong>Error:</strong> {error}
    </div>
  );

  return (
    <div className="relative flex-1">
      <Popover
        open={isPopoverOpen}
        onOpenChange={(open) => {
          if (!open && !isLoading && !keepEngaged) {
            reset();
          }
        }}
      >
        <PopoverAnchor asChild>
          <div
            ref={inputBarRef}
            className="relative select-none flex items-start gap-2 w-full !border-none !bg-transparent"
          >
            <VoiceInputBar
              state={voiceUiState}
              uiState={voiceUiState}
              transcript={voiceLiveTranscript || voiceTranscript}
              stream={voiceStream}
              onMicClick={handleMicClick}
              onCancel={handleVoiceCancel}
              onConfirm={handleVoiceConfirm}
              isProcessing={voiceUiState === "processing"}
              className="flex-1 mt-0.5"
              inputValue={input}
              onInputChange={setInput}
              inputRef={inputRef}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              disabled={isLoading || isHidden || voiceUiState === "processing"}
              isProviderConfigured={isProviderConfigured}
              errorMessage={voiceError}
            />
            {!isLoading && voiceUiState === "idle" && (
              <MessageHistory
                conversationHistory={conversationHistory}
                currentConversationId={currentConversationId}
                onStartNewConversation={startNewConversation}
                messageHistoryOpen={messageHistoryOpen}
                setMessageHistoryOpen={setMessageHistoryOpen}
              />
            )}
            {trailingControls}
          </div>
        </PopoverAnchor>

        {/* Response Panel */}
        <TransparentPopoverContent
          align="end"
          side="bottom"
          className="w-screen p-0 border overflow-hidden"
          sideOffset={8}
          onInteractOutside={keepResponseOpenOnInteraction}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <div className="flex flex-row gap-1 items-center">
              <h3 className="font-semibold text-xs select-none">
                {keepEngaged ? "Conversation Mode" : "AI Response"}
              </h3>
              <div className="text-[10px] text-muted-foreground/70">
                (Use arrow keys to scroll)
              </div>
            </div>
            <div className="flex items-center gap-2 select-none">
              <div className="flex flex-row items-center gap-2 mr-2">
                <p className="text-[10px]">{`Toggle ${keepEngaged ? "AI response" : "conversation mode"
                  }`}</p>
                <span className="text-[10px] text-muted-foreground/60 px-1 py-0 rounded border border-input/50">
                  {navigator.platform.toLowerCase().includes("mac")
                    ? "⌘"
                    : "Ctrl"}{" "}
                  + K
                </span>
                <Switch
                  checked={keepEngaged}
                  onCheckedChange={(checked) => {
                    setKeepEngaged(checked);
                    setTimeout(() => {
                      inputRef?.current?.focus();
                    }, 100);
                  }}
                />
              </div>
              <CopyButton content={response} />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (isLoading) {
                    cancel();
                  } else if (keepEngaged) {
                    setKeepEngaged(false);
                    startNewConversation();
                  } else {
                    reset();
                  }
                }}
                className="cursor-pointer"
                title={
                  isLoading
                    ? "Cancel loading"
                    : keepEngaged
                      ? "Close and start new conversation"
                      : "Clear conversation"
                }
              >
                <XIcon />
              </Button>
            </div>
          </div>

          <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-7rem)]">
            <div className="p-4">
              {keepEngaged ? (
                // Conversation: history oldest → newest, then the question just
                // sent and its streaming answer at the bottom.
                <div className="space-y-3" data-testid="conversation-thread">
                  {chronologicalHistory.map(renderThreadMessage)}
                  {pendingMessage && renderThreadMessage(pendingMessage)}
                  {pendingMessage &&
                    response &&
                    renderThreadMessage({
                      id: `${pendingMessage.id}_answer`,
                      role: "assistant",
                      content: response,
                      timestamp: pendingMessage.timestamp,
                    })}
                  {!pendingMessage &&
                    chronologicalHistory.length === 0 &&
                    response && <Markdown>{response}</Markdown>}
                  {isLoading && !response && renderGenerating()}
                  {error && renderError()}
                </div>
              ) : (
                <>
                  {error && renderError()}
                  {isLoading && renderGenerating()}
                  {response && <Markdown>{response}</Markdown>}
                </>
              )}
            </div>
          </ScrollArea>
        </TransparentPopoverContent>
      </Popover>
    </div>
  );
};
