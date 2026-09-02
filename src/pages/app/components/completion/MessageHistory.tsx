import { MessageSquareText, ChevronUp, ChevronDown, ArrowLeft, History } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  Button,
  ScrollArea,
  Markdown,
  Badge,
} from "@/components";
import { TransparentPopoverContent } from "@/components/ui/popover";
import { ChatMessage, ChatConversation } from "@/types/completion";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getAllConversations, getConversationById } from "@/lib/database/chat-history.action";
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
  currentConversationId,
  onStartNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
}: MessageHistoryProps) => {
  const [allConversations, setAllConversations] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "conversation">("list");
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);

  // Load all conversations when popover opens
  useEffect(() => {
    if (messageHistoryOpen) {
      loadAllConversations();
      // If currently in a conversation, show it
      if (currentConversationId && conversationHistory.length > 0) {
        setViewMode("conversation");
        loadCurrentConversation();
      } else {
        setViewMode("list");
      }
    }
  }, [messageHistoryOpen]);

  const loadCurrentConversation = useCallback(async () => {
    if (currentConversationId) {
      try {
        const conv = await getConversationById(currentConversationId);
        if (conv) {
          setSelectedConversation(conv);
        }
      } catch (error) {
        console.error("Failed to load current conversation:", error);
      }
    }
  }, [currentConversationId]);

  const loadAllConversations = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      const conversations = await getAllConversations();
      setAllConversations(conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSelectConversation = useCallback(async (conversation: ChatConversation) => {
    // Immediate UI feedback
    setSelectedConversation(conversation);
    setViewMode("conversation");
    
    // Close popover immediately for better UX
    setMessageHistoryOpen(false);
    
    // Dispatch event to load this conversation in the main app
    // Use setTimeout to ensure popover closes first
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("conversationSelected", {
          detail: { id: conversation.id },
        })
      );
    }, 50);
  }, [setMessageHistoryOpen]);

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedConversation(null);
  }, []);

  const handleNewChat = useCallback(() => {
    onStartNewConversation();
    setViewMode("list");
    setSelectedConversation(null);
    setMessageHistoryOpen(false);
  }, [onStartNewConversation, setMessageHistoryOpen]);

  const isInActiveConversation = useMemo(
    () => currentConversationId !== null && conversationHistory.length > 0,
    [currentConversationId, conversationHistory.length]
  );

  const sortedMessages = useMemo(() => {
    const messages = selectedConversation?.messages || conversationHistory;
    return messages.slice().sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedConversation, conversationHistory]);

  const filteredConversations = useMemo(() => {
    return allConversations.filter(conv => conv.id !== currentConversationId);
  }, [allConversations, currentConversationId]);

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
            {isInActiveConversation ? conversationHistory.length : allConversations.length}
          </div>
          <MessageSquareText className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <TransparentPopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 mt-3 border overflow-hidden border-input/50"
      >
        {/* Header */}
        <div className="border-b border-input/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Back button when viewing a conversation */}
              {viewMode === "conversation" && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleBackToList}
                  className="h-8 w-8"
                  title="Back to conversations list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              
              <div className="flex flex-col">
                {viewMode === "list" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      <h2 className="text-base font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Conversation History
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {allConversations.length} total conversation{allConversations.length !== 1 ? "s" : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-base font-bold line-clamp-1">
                      {selectedConversation?.title || "Conversation"}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {selectedConversation?.messages.length || conversationHistory.length} messages
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedConversation 
                          ? moment(selectedConversation.updatedAt).format("MMM D, YYYY • h:mm A")
                          : ""}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* New Chat button */}
              <Button
                size="sm"
                onClick={handleNewChat}
                className="text-xs h-8"
                variant={viewMode === "list" ? "default" : "outline"}
              >
                + New Chat
              </Button>
              
              {/* Close button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setMessageHistoryOpen(false)}
                className="h-8 w-8"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <ScrollArea className="h-[calc(100vh-10rem)]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-pulse">Loading conversations...</div>
            </div>
          ) : viewMode === "conversation" ? (
            // Show selected conversation messages
            <div className="p-4 space-y-4">
              {sortedMessages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`p-3 rounded-lg transition-all ${
                      message.role === "user"
                        ? "bg-primary/5 border-l-4 border-primary ml-2"
                        : "bg-accent/30 mr-2"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold uppercase ${
                        message.role === "user" ? "text-primary" : "text-foreground/80"
                      }`}>
                        {message.role === "user" ? "You" : "AI"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-sm">
                      <Markdown>{message.content}</Markdown>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Show all conversations list
            <div className="p-4 space-y-2">
              {allConversations.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No conversations yet</p>
                  <p className="text-xs mt-1">Start chatting to create your first conversation!</p>
                </div>
              ) : (
                <>
                  {/* Current/Active conversation indicator */}
                  {isInActiveConversation && (
                    <div className="mb-3 pb-3 border-b border-input/30">
                      <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        ACTIVE CONVERSATION
                      </p>
                      <div
                        onClick={() => {
                          if (currentConversationId) {
                            const conv = allConversations.find(c => c.id === currentConversationId);
                            if (conv) handleSelectConversation(conv);
                          }
                        }}
                        className="p-3 rounded-lg border-2 border-primary/50 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold line-clamp-1">
                            {allConversations.find(c => c.id === currentConversationId)?.title || "Current Chat"}
                          </p>
                          <Badge variant="default" className="text-xs">
                            {conversationHistory.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Click to view full conversation
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* All other conversations */}
                  <p className="text-xs font-semibold text-muted-foreground mb-2 mt-2">
                    ALL CONVERSATIONS
                  </p>
                  {filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className="p-3 rounded-lg border border-input/50 hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                            {conv.title}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {moment(conv.updatedAt).fromNow()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {conv.messages.length} message{conv.messages.length !== 1 ? "s" : ""}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {moment(conv.updatedAt).format("MMM D, YYYY")}
                          </span>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </TransparentPopoverContent>
    </Popover>
  );
};
