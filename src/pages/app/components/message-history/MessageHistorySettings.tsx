import { HistoryIcon, Trash2 } from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Empty } from "@/components";
import { useHistory } from "@/hooks/useHistory";
import { DeleteConfirmationDialog } from "@/pages/chats/components/DeleteConfirmation";
import { MESSAGE_HISTORY_ROUTE } from "./message-history.constants";
import { displayTitle, pluralize } from "./message-history.utils";

/** Conversation list shown under Toggle Settings → Message History. */
export const MessageHistorySettings = () => {
  const navigate = useNavigate();
  const {
    conversations,
    isLoading,
    isDeleting,
    deleteConfirm,
    handleDeleteConfirm,
    confirmDelete,
    cancelDelete,
    deleteAllConfirm,
    handleDeleteAllConfirm,
    confirmDeleteAll,
    cancelDeleteAll,
  } = useHistory();

  const pendingDelete = conversations.find((c) => c.id === deleteConfirm);
  const count = conversations.length;

  return (
    // The settings ScrollArea sizes its content to the widest child, so cap the
    // width at the viewport (minus the shell's px-4) to keep rows from overflowing.
    <div className="max-w-[calc(100vw-2rem)] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Loading conversations…" : pluralize(count, "conversation")}
        </p>
        <Button
          data-tauri-drag-region={false}
          disabled={count === 0 || isLoading || isDeleting}
          onClick={handleDeleteAllConfirm}
          size="sm"
          title="Delete all conversations"
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete All
        </Button>
      </div>

      {count === 0 ? (
        <Empty
          description="Your conversations will appear here."
          icon={HistoryIcon}
          isLoading={isLoading}
          title="No conversations yet"
        />
      ) : (
        <ul aria-label="Conversations" className="space-y-2">
          {conversations.map((conversation) => {
            const title = displayTitle(conversation.title);
            return (
              <li
                className="flex min-w-0 items-center gap-2 rounded-lg border border-input/50 p-3 transition-colors hover:border-primary/50 hover:bg-accent/50"
                key={conversation.id}
              >
                <button
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  data-tauri-drag-region={false}
                  onClick={() =>
                    navigate(`${MESSAGE_HISTORY_ROUTE}/${conversation.id}`)
                  }
                  title={title}
                  type="button"
                >
                  <span className="block truncate text-sm font-medium">
                    {title}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge className="text-xs" variant="outline">
                      {pluralize(conversation.messages.length, "message")}
                    </Badge>
                    {moment(conversation.updatedAt).format("MMM D, YYYY • h:mm A")}
                  </span>
                </button>
                <Button
                  aria-label={`Delete conversation ${title}`}
                  className="shrink-0"
                  data-tauri-drag-region={false}
                  disabled={isDeleting}
                  onClick={() => handleDeleteConfirm(conversation.id)}
                  size="icon"
                  title="Delete conversation"
                  variant="ghost"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <DeleteConfirmationDialog
        cancelDelete={cancelDelete}
        confirmDelete={confirmDelete}
        deleteConfirm={deleteConfirm}
        description={`Delete "${displayTitle(pendingDelete?.title)}"? This can't be undone.`}
        isLoading={isDeleting}
      />
      <DeleteConfirmationDialog
        cancelDelete={cancelDeleteAll}
        confirmDelete={confirmDeleteAll}
        confirmLabel="Delete All"
        description={`Delete all ${pluralize(count, "conversation")}? This can't be undone.`}
        isLoading={isDeleting}
        open={deleteAllConfirm}
        title="Delete All Conversations"
      />
    </div>
  );
};
