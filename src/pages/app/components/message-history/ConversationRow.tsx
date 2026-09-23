import type { ReactNode } from "react";
import type { ChatConversation } from "@/types/completion";
import { cn } from "@/lib/utils";
import {
  displayTitle,
  formatConversationDate,
  pluralize,
} from "./message-history.utils";

interface ConversationRowProps {
  conversation: ChatConversation;
  isCurrent?: boolean;
  onOpen: (conversation: ChatConversation) => void;
  /** Secondary actions (e.g. Delete). Rendered beside, never inside, the open button. */
  actions?: ReactNode;
}

/**
 * Compact conversation row shared by the history surfaces. The row itself is a
 * button; secondary actions sit next to it so they can never open the row.
 */
export const ConversationRow = ({
  conversation,
  isCurrent = false,
  onOpen,
  actions,
}: ConversationRowProps) => {
  const title = displayTitle(conversation.title);

  return (
    <li
      className={cn(
        "group flex min-w-0 items-center gap-1 rounded-xl transition-colors",
        isCurrent ? "bg-primary/10" : "hover:bg-foreground/5"
      )}
      data-conversation-id={conversation.id}
      data-current={isCurrent || undefined}
    >
      <button
        aria-current={isCurrent ? "true" : undefined}
        className="min-w-0 flex-1 cursor-pointer rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-conversation-row
        data-tauri-drag-region={false}
        onClick={() => onOpen(conversation)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium" data-conversation-title>
            {title}
          </span>
          {isCurrent && (
            <span className="shrink-0 text-[11px] font-medium text-primary">
              Current
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {formatConversationDate(conversation.updatedAt)}
          {" · "}
          {pluralize(conversation.messages.length, "message")}
        </span>
      </button>
      {actions && <div className="flex shrink-0 items-center pr-1.5">{actions}</div>}
    </li>
  );
};
