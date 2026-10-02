import { Loader2 } from "lucide-react";
import { Markdown } from "@/components";
import type { AttachedFile, ChatMessage } from "@/types/completion";

/**
 * The attachments stored with a message (names only; image data isn't kept).
 * Skips missing or malformed records from older saves.
 */
const attachmentNames = (message: ChatMessage): string[] =>
  Array.isArray(message.attachedFiles)
    ? message.attachedFiles
        .filter(
          (file): file is AttachedFile =>
            !!file && typeof file.name === "string" && file.name.trim() !== ""
        )
        .map((file) => file.name)
    : [];

interface ThreadMessageProps {
  message: ChatMessage;
  /** "li" inside a list (Message History), "div" in the answer panel. */
  as?: "div" | "li";
  /** The answer streaming in for the question just sent. */
  isStreaming?: boolean;
}

/**
 * One message in Conversation Mode style, shared by the answer panel's
 * Conversation Mode and the main bar's Message History so both read the same.
 */
export const ThreadMessage = ({ message, as: Tag = "div", isStreaming }: ThreadMessageProps) => {
  const attachments = attachmentNames(message);
  return (
    <Tag
      aria-busy={isStreaming || undefined}
      className={`p-3 rounded-lg text-sm ${message.role === "user" ? "border-l-4 border-primary" : ""}`}
      data-role={message.role}
      data-streaming={isStreaming || undefined}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {message.role === "user" ? "You" : "AI"}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <Markdown>{message.content}</Markdown>
      {attachments.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground break-words" data-testid="message-attachments">
          Attached: {attachments.join(", ")}
        </p>
      )}
    </Tag>
  );
};

/** Conversation Mode's "answer on its way" line. */
export const ThreadGenerating = ({ as: Tag = "div" }: { as?: "div" | "li" }) => (
  <Tag
    aria-busy="true"
    className="flex items-center gap-2 my-4 text-muted-foreground animate-pulse select-none"
    data-role="assistant"
    data-streaming="true"
  >
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm" role="status">
      Generating response...
    </span>
  </Tag>
);
