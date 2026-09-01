import { MessageSquareText, ChevronUp, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  Button,
  ScrollArea,
  Markdown,
} from "@/components";
import { TransparentPopoverContent } from "@/components/ui/popover";
import { ChatMessage, ChatConversation } from "@/types/completion";
import { useState, useEffect } from "react";
import { getAllConversations } from "@/lib/database/chat-history.action";
import moment from "moment";

interface MessageHistoryProps {
  conversationHistory: ChatMessage[];
  currentConversationId: string | null;
  onStartNewConversation: () => void;
  messageHistoryOpen: boolean;
  setMessageHistoryOpen: (open: boolean) => void;
}

export const MessageHistory = ({
  conversationHistory,
  onStartNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
}: MessageHistoryProps) => {
  const [allConversations, setAllConversations] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load all conversations when popover opens
  useEffect(() => {
    if (messageHistoryOpen) {
      loadAllConversations();
    }
  }, [messageHistoryOpen]);

  const loadAllConversations = async () => {
    try {
      setIsLoading(true);
      const conversations = await getAllConversations();
      setAllConversations(conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = (conversation: ChatConversation) => {
    // Dispatch event to load this conversation
    window.dispatchEvent(
      new CustomEvent("conversationSelected", {
        detail: { id: conversation.id },
      })
    );
    setMessageHistoryOpen(false);
  };
  return (
    <Popover open={messageHistoryOpen} onOpenChange={setMessageHistoryOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label="View Conversations"
          className="relative cursor-pointer w-12 h-7 px-2 flex gap-1 items-center justify-center"
        >
          <div className="flex items-center justify-center text-xs font-medium">
            {conversationHistory.length > 0 ? conversationHistory.length : allConversations.length}
          </div>
          <MessageSquareText className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <TransparentPopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 mt-3 border overflow-hidden border-input/50"
      >
        <div className="border-b border-input/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-col">
              <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {conversationHistory.length > 0 ? "Current Conversation" : "All Conversations"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {conversationHistory.length > 0 
                  ? `${conversationHistory.length} messages in this conversation`
                  : `${allConversations.length} total conversations`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onStartNewConversation();
                  setMessageHistoryOpen(false);
                }}
                className="text-xs"
              >
                New Chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMessageHistoryOpen(false)}
                className="text-xs"
              >
                {messageHistoryOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-10rem)]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading conversations...</div>
          ) : conversationHistory.length > 0 ? (
            // Show current conversation messages
            <div className="p-4 space-y-4">
              {conversationHistory
                .sort((a, b) => b?.timestamp - a?.timestamp)
                .map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg ${
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
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <Markdown>{message.content}</Markdown>
                  </div>
                ))}
            </div>
          ) : (
            // Show all conversations list
            <div className="p-4 space-y-2">
              {allConversations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No conversations yet. Start chatting!
                </div>
              ) : (
                allConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className="p-3 rounded-lg border border-input/50 hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium line-clamp-1">{conv.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {moment(conv.updatedAt).format("MMM D")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {conv.messages.length} messages
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </TransparentPopoverContent>
    </Popover>
  );
};
