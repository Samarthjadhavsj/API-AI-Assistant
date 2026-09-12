import { Loader2, XIcon } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  Button,
  ScrollArea,
  Markdown,
  Switch,
  CopyButton,
} from "@/components";
import { TransparentPopoverContent } from "@/components/ui/popover";
import { UseCompletionReturn } from "@/types";
import { MessageHistory } from "./MessageHistory";
import { VoiceInputBar } from "./VoiceInputBar";
import { useState, useEffect } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useApp } from "@/contexts";

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
}: UseCompletionReturn & { isHidden: boolean; onVoiceStateChange?: (state: string) => void }) => {
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "active">("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const { selectedAudioDevices, selectedSttProvider } = useApp();
  const isProviderConfigured = Boolean(selectedSttProvider.variables.api_key?.trim());

  const voice = useVoiceInput({
    maxDurationMs: 3 * 60 * 1000,
    onResult: (result) => {
      const transcript = result.text.trim();
      if (transcript) {
        setVoiceTranscript(transcript);
      }
    },
  });

  const handleMicClick = async () => {
    if (!isProviderConfigured) {
      console.warn("[VoiceInput] STT provider not configured");
      return;
    }

    console.log("[VoiceInput] Mic clicked, current voiceState:", voiceState);

    if (voiceState === "idle") {
      console.log("[VoiceInput] Starting voice recording...");
      setVoiceState("listening");
      try {
        await voice.start(selectedAudioDevices.input || undefined);
        console.log("[VoiceInput] Voice recording started successfully");
      } catch (error) {
        console.error("[VoiceInput] Failed to start voice recording:", error);
        setVoiceState("idle");
        // Show error to user
        const errorMessage = error instanceof Error ? error.message : "Failed to access microphone";
        console.error("[VoiceInput] Microphone error:", errorMessage);
        // You could add a toast notification here
        alert(`Microphone error: ${errorMessage}. Please check your microphone permissions and try again.`);
      }
    } else {
      console.log("[VoiceInput] Canceling voice recording...");
      handleVoiceCancel();
    }
  };

  const handleVoiceCancel = () => {
    console.log("[VoiceInput] Voice canceled");
    voice.cancel();
    setVoiceState("idle");
    setVoiceTranscript("");
    setVoiceStream(null);
  };

  const handleVoiceConfirm = async () => {
    console.log("[VoiceInput] Voice confirmed, transcript:", voiceTranscript);
    if (voiceTranscript) {
      setInput(voiceTranscript);
      // Focus the input after setting the transcript
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
    console.log("[VoiceInput] Stopping voice recording...");
    try {
      await voice.stop();
      console.log("[VoiceInput] Voice recording stopped successfully");
    } catch (error) {
      console.error("[VoiceInput] Error stopping voice recording:", error);
    }
    setVoiceState("idle");
    setVoiceTranscript("");
    setVoiceStream(null);
  };

  // Update voice stream when recording
  useEffect(() => {
    console.log("[VoiceInput] Voice state changed:", voice.state, "Stream:", !!voice.stream, voice.stream ? `(${voice.stream.getTracks().length} tracks)` : "");
    if (voice.state === "recording" && voice.stream) {
      setVoiceStream(voice.stream);
    } else {
      setVoiceStream(null);
    }
  }, [voice.state, voice.stream]);

  // Auto-transition to active state when voice is detected
  useEffect(() => {
    console.log("[VoiceInput] Checking transition: voiceState=", voiceState, "transcript=", voiceTranscript);
    if (voiceState === "listening" && voiceTranscript) {
      console.log("[VoiceInput] Transitioning to active state");
      setVoiceState("active");
    }
  }, [voiceTranscript, voiceState]);

  // Reset to idle when voice stops
  useEffect(() => {
    if (voice.state === "idle" && voiceState !== "idle") {
      console.log("[VoiceInput] Voice controller is idle, resetting UI state");
      setVoiceState("idle");
    }
  }, [voice.state, voiceState]);

  // Notify parent of voice state changes
  useEffect(() => {
    onVoiceStateChange?.(voiceState);
  }, [voiceState, onVoiceStateChange]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log("[VoiceInput] Input component unmounting, cleaning up voice resources");
      if (voiceState !== "idle") {
        console.log("[VoiceInput] Active voice session on unmount, canceling");
        voice.cancel();
      }
      if (voiceStream) {
        console.log("[VoiceInput] Cleaning up voice stream on unmount");
        voiceStream.getTracks().forEach(track => {
          try {
            if (track.readyState !== 'ended') {
              track.stop();
            }
          } catch (error) {
            console.error("[VoiceInput] Error stopping track on unmount:", error);
          }
        });
      }
    };
  }, [voiceState, voiceStream, voice]);

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
        <PopoverTrigger asChild className="!border-none !bg-transparent">
          <div className="relative select-none flex items-center gap-2 w-full">
            <VoiceInputBar
              state={voiceState}
              transcript={voiceTranscript}
              stream={voiceStream}
              onMicClick={handleMicClick}
              onCancel={handleVoiceCancel}
              onConfirm={handleVoiceConfirm}
              className="flex-1"
              inputValue={input}
              onInputChange={setInput}
              inputRef={inputRef}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              disabled={isLoading || isHidden}
            />
            {!isLoading && voiceState === "idle" && (
              <MessageHistory
                conversationHistory={conversationHistory}
                currentConversationId={currentConversationId}
                onStartNewConversation={startNewConversation}
                messageHistoryOpen={messageHistoryOpen}
                setMessageHistoryOpen={setMessageHistoryOpen}
              />
            )}
            {!isLoading && voiceState !== "idle" && (
              <div className="w-8 shrink-0" />
            )}
          </div>
        </PopoverTrigger>

        {/* Response Panel */}
        <TransparentPopoverContent
          align="end"
          side="bottom"
          className="w-screen p-0 border overflow-hidden"
          sideOffset={8}
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
                <p className="text-[10px]">{`Toggle ${
                  keepEngaged ? "AI response" : "conversation mode"
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
                    // Focus input after toggle
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
                    // When keepEngaged is on, close everything and start new conversation
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
              {error && (
                <div className="mb-4 p-3 border border-destructive/20 rounded text-sm text-destructive">
                  <strong>Error:</strong> {error}
                </div>
              )}
              {isLoading && (
                <div className="flex items-center gap-2 my-4 text-muted-foreground animate-pulse select-none">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Generating response...</span>
                </div>
              )}
              {response && <Markdown>{response}</Markdown>}

              {/* Conversation History - Separate scroll, no auto-scroll */}
              {keepEngaged && conversationHistory.length > 1 && (
                <div className="space-y-3 pt-3">
                  {conversationHistory
                    .sort((a, b) => b?.timestamp - a?.timestamp)
                    .map((message, index) => {
                      if (!isLoading && index === 0) {
                        return null;
                      }
                      return (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg text-sm ${
                            message.role === "user"
                              ? "border-l-4 border-primary"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {message.role === "user" ? "You" : "AI"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.timestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>
                          <Markdown>{message.content}</Markdown>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </ScrollArea>
        </TransparentPopoverContent>
      </Popover>
    </div>
  );
};
