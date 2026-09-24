import { useMemo } from "react";
import moment from "moment";
import { FileText, Image as ImageIcon } from "lucide-react";
import { Markdown } from "@/components";
import { isImageAttachment } from "@/lib/attachments";
import type { AttachedFile, ChatMessage } from "@/types/completion";

interface ConversationTranscriptProps {
  messages: ChatMessage[];
}

/**
 * The attachments stored with a message (names and types only; image data
 * isn't kept). Skips missing or malformed records from older saves.
 */
const storedAttachments = (message: ChatMessage): AttachedFile[] =>
  Array.isArray(message.attachedFiles)
    ? message.attachedFiles.filter(
        (file): file is AttachedFile =>
          !!file && typeof file.name === "string" && file.name.trim() !== ""
      )
    : [];

const MessageAttachments = ({ attachments }: { attachments: AttachedFile[] }) => (
  <ul aria-label="Attachments" className="mt-2 flex flex-wrap gap-1.5">
    {attachments.map((file, index) => {
      const isImage = isImageAttachment({
        kind: file.kind,
        type: typeof file.type === "string" ? file.type : "",
      });
      const Icon = isImage ? ImageIcon : FileText;
      return (
        <li
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
          key={file.id || index}
          title={file.name}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">{isImage ? "Image: " : "File: "}</span>
          <span className="truncate">{file.name}</span>
        </li>
      );
    })}
  </ul>
);

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
        const attachments = storedAttachments(message);
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
            {attachments.length > 0 && <MessageAttachments attachments={attachments} />}
          </li>
        );
      })}
    </ol>
  );
};
