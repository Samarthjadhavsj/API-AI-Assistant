import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import {
  Loader2,
  MessageCircleIcon,
  SparklesIcon,
  Trash2,
  UserIcon,
} from "lucide-react";
import { Badge, Button, Card, Empty, Markdown } from "@/components";
import { useHistory } from "@/hooks/useHistory";
import { getConversationById } from "@/lib/database/chat-history.action";
import { DeleteConfirmationDialog } from "@/pages/chats/components/DeleteConfirmation";
import type { ChatConversation } from "@/types/completion";
import { ToggleSettingsShell } from "../../ToggleSettingsShell";
import { MESSAGE_HISTORY_ROUTE } from "./message-history.constants";
import { displayTitle, pluralize } from "./message-history.utils";

/** Read-only conversation view under Toggle Settings → Message History. */
const MessageHistoryConversation = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const {
    deleteConfirm,
    handleDeleteConfirm,
    confirmDelete,
    cancelDelete,
    isDeleting,
  } = useHistory();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getConversationById(conversationId ?? "")
      .then((result) => {
        if (!cancelled) setConversation(result ?? null);
      })
      .catch((error) => {
        console.error("Failed to load conversation:", error);
        if (!cancelled) setConversation(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const handleDelete = async () => {
    await confirmDelete();
    navigate(MESSAGE_HISTORY_ROUTE);
  };

  const messageCount = conversation?.messages.length ?? 0;

  return (
    <ToggleSettingsShell
      backTo={MESSAGE_HISTORY_ROUTE}
      description={
        conversation
          ? `${pluralize(messageCount, "message")} • ${moment(conversation.updatedAt).format("MMM D, YYYY • h:mm A")}`
          : "Conversation"
      }
      title={
        conversation
          ? displayTitle(conversation.title)
          : isLoading
            ? "Conversation"
            : "Conversation not found"
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 aria-label="Loading conversation" className="size-6 animate-spin" />
        </div>
      ) : !conversation ? (
        <Empty
          description="It may have been deleted. Use Back to return to Message History."
          icon={MessageCircleIcon}
          title="Conversation not found"
        />
      ) : (
        // Same ScrollArea width cap as the list view (see MessageHistorySettings)
        <div className="max-w-[calc(100vw-2rem)] space-y-4">
          <div className="flex justify-end">
            <Button
              data-tauri-drag-region={false}
              disabled={isDeleting}
              onClick={() => handleDeleteConfirm(conversation.id)}
              size="sm"
              title="Delete conversation"
              variant="destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>

          {messageCount === 0 ? (
            <Empty
              description="This conversation has no messages."
              icon={MessageCircleIcon}
              title="No messages found"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {conversation.messages.map((message, index, array) => {
                const isUser = message.role === "user";
                const showDate =
                  index === 0 ||
                  moment(message.timestamp).format("YYYY-MM-DD") !==
                    moment(array[index - 1]?.timestamp).format("YYYY-MM-DD");

                return (
                  <div key={message.id || index}>
                    {showDate && (
                      <Badge
                        className="mx-auto my-2 flex w-fit items-center justify-center"
                        variant="outline"
                      >
                        {moment(message.timestamp).format("ddd, MMM D")}
                      </Badge>
                    )}
                    <div
                      className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <SparklesIcon className="size-3 text-primary" />
                        </div>
                      )}
                      <div
                        className={`flex min-w-0 max-w-[80%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                      >
                        <Card
                          className={`max-w-full px-3 py-0 text-xs shadow-none select-text break-words [overflow-wrap:anywhere] ${
                            isUser
                              ? "!bg-primary text-primary-foreground !border-primary rounded-tr-sm"
                              : "!bg-muted/50 dark:!bg-muted/30 rounded-tl-sm"
                          }`}
                        >
                          <Markdown>{message.content}</Markdown>
                        </Card>
                        <span className="text-[10px] text-muted-foreground">
                          {moment(message.timestamp).format("hh:mm A")}
                        </span>
                      </div>
                      {isUser && (
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
                          <UserIcon className="size-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <DeleteConfirmationDialog
        cancelDelete={cancelDelete}
        confirmDelete={handleDelete}
        deleteConfirm={deleteConfirm}
        description={`Delete "${displayTitle(conversation?.title)}"? This can't be undone.`}
        isLoading={isDeleting}
      />
    </ToggleSettingsShell>
  );
};

export default MessageHistoryConversation;
