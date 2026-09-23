import { useMemo } from "react";
import moment from "moment";
import { Markdown } from "@/components";
import type { ChatMessage } from "@/types/completion";

interface ConversationTranscriptProps {
  messages: ChatMessage[];
}

/**
 * Minimal, read-only Q&A transcript: "You" / "Frank" labels instead of chat
 * bubbles, oldest first. Long text, URLs, and unbroken strings wrap in place.
 */
export const ConversationTranscript = ({ messages }: ConversationTranscriptProps) => {
  const ordered = useMemo(
    () =>
      messages
        .filter((message) => message.role !== "system")
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  return (
    <ol
      aria-label="Conversation"
      className="min-w-0 select-text space-y-5 break-words [overflow-wrap:anywhere]"
    >
      {ordered.map((message, index) => {
        const isUser = message.role === "user";
        const startsExchange = isUser && index > 0;
        return (
          <li
            className={startsExchange ? "border-t border-border/40 pt-5" : undefined}
            data-role={message.role}
            key={message.id || index}
          >
            <div className="mb-1 flex items-baseline gap-2">
              <span
                className={
                  isUser
                    ? "text-xs font-semibold text-foreground"
                    : "text-xs font-semibold text-primary"
                }
              >
                {isUser ? "You" : "Frank"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {moment(message.timestamp).format("h:mm A")}
              </span>
            </div>
            <div
              className={
                isUser
                  ? "min-w-0 text-sm font-medium leading-relaxed text-foreground"
                  : "min-w-0 text-sm leading-relaxed text-foreground/90"
              }
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <Markdown>{message.content}</Markdown>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
