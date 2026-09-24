import { ChevronLeft, MessageSquareText, Trash2, XIcon } from "lucide-react";
import { Popover, PopoverTrigger, Button, ScrollArea } from "@/components";
import { TransparentPopoverContent } from "@/components/ui/popover";
import { ChatMessage } from "@/types/completion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import { useHistory } from "@/hooks/useHistory";
import { DeleteConfirmationDialog } from "@/pages/chats/components/DeleteConfirmation";
import { ConversationRow } from "@/pages/app/components/message-history/ConversationRow";
import { ConversationTranscript } from "@/pages/app/components/message-history/ConversationTranscript";
import {
  HistoryEmpty,
  HistoryLoading,
} from "@/pages/app/components/message-history/HistoryStates";
import {
  displayTitle,
  pluralize,
  sortConversationsByRecent,
} from "@/pages/app/components/message-history/message-history.utils";

interface MessageHistoryProps {
  conversationHistory: ChatMessage[];
  currentConversationId: string | null;
  onStartNewConversation: () => void;
  messageHistoryOpen: boolean;
  setMessageHistoryOpen: (open: boolean) => void;
}

const iconButton =
  "size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground";

/**
 * The main search bar: the voice/text bar inside the response popover's
 * anchor. The anchor also wraps the history icon and the mic, so match the bar
 * itself rather than the whole anchor.
 */
const MAIN_SEARCH_BAR = '[data-slot="popover-anchor"] [data-voice-state]';

/**
 * Overlay conversation browser: Recent Conversations → a conversation's Q&A.
 * Back and Close are explicit state transitions (no browser history), and none
 * of this touches the main input's response state unless the user chooses
 * "Continue chat". Full management (Delete All, routes) stays in
 * Toggle Settings → Message History; both read the same `useHistory` data.
 */
export const MessageHistory = ({
  conversationHistory,
  currentConversationId,
  onStartNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
}: MessageHistoryProps) => {
  // Stays mounted with the overlay, so load when opened rather than on mount.
  const {
    conversations,
    isLoading,
    refreshConversations,
    deleteConfirm,
    handleDeleteConfirm,
    confirmDelete,
    cancelDelete,
    isDeleting,
  } = useHistory({ autoLoad: false });
  const [openConversationId, setOpenConversationId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  // Row to refocus when returning from a conversation to the list
  const returnFocusIdRef = useRef<string | null>(null);
  // Radix reports both the pointerdown and the resulting focus as outside
  // interactions; continue a previewed conversation at most once per open.
  const continuedFromSearchBarRef = useRef(false);

  // Every open starts at Recent Conversations with fresh data.
  useEffect(() => {
    if (messageHistoryOpen) {
      setOpenConversationId(null);
      returnFocusIdRef.current = null;
      continuedFromSearchBarRef.current = false;
      refreshConversations();
    }
  }, [messageHistoryOpen, refreshConversations]);

  const recentConversations = useMemo(
    () => sortConversationsByRecent(conversations),
    [conversations]
  );
  const openConversation = openConversationId
    ? conversations.find((c) => c.id === openConversationId) ?? null
    : null;

  // Keep keyboard focus where the user expects it after switching views.
  useEffect(() => {
    if (!messageHistoryOpen) return;
    if (openConversation) {
      backButtonRef.current?.focus();
    } else if (returnFocusIdRef.current) {
      listRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-conversation-id="${returnFocusIdRef.current}"] [data-conversation-row]`
        )
        ?.focus();
      returnFocusIdRef.current = null;
    }
  }, [messageHistoryOpen, openConversation]);

  const showList = useCallback(() => {
    returnFocusIdRef.current = openConversationId;
    setOpenConversationId(null);
  }, [openConversationId]);

  const close = useCallback(() => setMessageHistoryOpen(false), [setMessageHistoryOpen]);

  const handleNewChat = useCallback(() => {
    onStartNewConversation();
    close();
  }, [onStartNewConversation, close]);

  // Resume in the main input via the existing conversationSelected workflow.
  const handleContinue = useCallback(
    (conversationId: string) => {
      close();
      // Let the popover close before the main input loads the conversation
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("conversationSelected", { detail: { id: conversationId } })
        );
      }, 50);
    },
    [close]
  );

  // Clicking or focusing the main search bar while previewing a conversation
  // means "continue this one": hand it to the main input through the same
  // Continue chat path. Anything else keeps Radix's normal dismiss, and the
  // click/focus itself still reaches the search bar (no preventDefault).
  const handleInteractOutside: ComponentProps<
    typeof TransparentPopoverContent
  >["onInteractOutside"] = (event) => {
    const target = event.target;
    if (!openConversationId || continuedFromSearchBarRef.current) return;
    if (!(target instanceof Element)) return;
    if (!target.closest(MAIN_SEARCH_BAR) || target.closest("button")) return;

    continuedFromSearchBarRef.current = true;
    // Already the active conversation: just close, keeping its state (and any draft).
    if (openConversationId === currentConversationId) return;
    handleContinue(openConversationId);
  };

  const handleConfirmDelete = useCallback(async () => {
    const deletingOpenConversation = deleteConfirm === openConversationId;
    await confirmDelete();
    if (deletingOpenConversation) setOpenConversationId(null);
  }, [confirmDelete, deleteConfirm, openConversationId]);

  // Up/Down move between rows; Enter/Space activate the focused row button.
  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-conversation-row]") ?? []
    );
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? rows[Math.min(index + 1, rows.length - 1)]
        : rows[Math.max(index - 1, 0)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  const isActiveConversation =
    currentConversationId !== null && conversationHistory.length > 0;
  const conversationCount = isActiveConversation
    ? conversationHistory.length
    : conversations.length;
  const pendingDelete = conversations.find((c) => c.id === deleteConfirm);
  const showLoading = isLoading && conversations.length === 0;

  return (
    <div className="relative mt-1 shrink-0">
      <Popover open={messageHistoryOpen} onOpenChange={setMessageHistoryOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="size-8 cursor-pointer"
            aria-label="View Conversations"
            title="View Conversations"
            data-tauri-drag-region={false}
          >
            <MessageSquareText className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        {/* Conversation count badge */}
        {conversationCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary-foreground text-primary rounded-full h-5 w-5 flex border border-primary items-center justify-center text-xs font-medium pointer-events-none">
            {conversationCount}
          </div>
        )}

        <TransparentPopoverContent
          align="end"
          side="bottom"
          className="select-none w-screen p-0 mt-3 overflow-hidden rounded-2xl border border-input/40"
          aria-label={openConversation ? "Conversation" : "Recent Conversations"}
          onInteractOutside={handleInteractOutside}
        >
          {openConversation ? (
            <header className="flex items-center gap-1 border-b border-border/40 px-2 py-2">
              <Button
                aria-label="Back to Recent Conversations"
                className={iconButton}
                onClick={showList}
                ref={backButtonRef}
                size="icon"
                title="Back"
                variant="ghost"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <div className="min-w-0 flex-1 px-1">
                <h2 className="truncate text-[15px] font-semibold tracking-tight">
                  {displayTitle(openConversation.title)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {pluralize(openConversation.messages.length, "message")}
                </p>
              </div>
              <Button
                className="h-8 shrink-0 rounded-full px-3 text-xs"
                onClick={() => handleContinue(openConversation.id)}
                size="sm"
                variant="secondary"
              >
                Continue chat
              </Button>
              <Button
                aria-label={`Delete conversation ${displayTitle(openConversation.title)}`}
                className={`${iconButton} hover:text-destructive`}
                disabled={isDeleting}
                onClick={() => handleDeleteConfirm(openConversation.id)}
                size="icon"
                title="Delete conversation"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                aria-label="Close Message History"
                className={iconButton}
                onClick={close}
                size="icon"
                title="Close"
                variant="ghost"
              >
                <XIcon className="size-4" />
              </Button>
            </header>
          ) : (
            <header className="flex items-center gap-2 border-b border-border/40 py-2.5 pl-4 pr-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-semibold tracking-tight">
                  Recent Conversations
                </h2>
                <p className="text-xs text-muted-foreground">
                  {showLoading ? "Loading…" : pluralize(conversations.length, "conversation")}
                </p>
              </div>
              <Button
                className="h-8 shrink-0 rounded-full px-3 text-xs"
                onClick={handleNewChat}
                size="sm"
                variant="secondary"
              >
                + New Chat
              </Button>
              <Button
                aria-label="Close Message History"
                className={iconButton}
                onClick={close}
                size="icon"
                title="Close"
                variant="ghost"
              >
                <XIcon className="size-4" />
              </Button>
            </header>
          )}

          {/* Radix ScrollArea wraps content in a display:table div that grows
              to the widest child; make it a block so everything wraps/truncates
              within the 600px window instead of scrolling sideways. */}
          <ScrollArea className="h-[calc(100vh-9rem)] [&_[data-radix-scroll-area-viewport]>div]:!block">
            {openConversation ? (
              <div className="px-5 py-4">
                <ConversationTranscript messages={openConversation.messages} />
              </div>
            ) : showLoading ? (
              <HistoryLoading />
            ) : recentConversations.length === 0 ? (
              <HistoryEmpty />
            ) : (
              <ul
                aria-label="Recent conversations"
                className="space-y-0.5 p-2"
                onKeyDown={handleListKeyDown}
                ref={listRef}
              >
                {recentConversations.map((conversation) => (
                  <ConversationRow
                      actions={
                        <Button
                          aria-label={`Delete conversation ${displayTitle(conversation.title)}`}
                          className={`${iconButton} opacity-60 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100`}
                          data-tauri-drag-region={false}
                          disabled={isDeleting}
                          onClick={() => handleDeleteConfirm(conversation.id)}
                          size="icon"
                          title="Delete conversation"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      conversation={conversation}
                      isCurrent={conversation.id === currentConversationId}
                      key={conversation.id}
                      onOpen={(c) => setOpenConversationId(c.id)}
                    />
                ))}
              </ul>
            )}
          </ScrollArea>

          <DeleteConfirmationDialog
            cancelDelete={cancelDelete}
            confirmDelete={handleConfirmDelete}
            deleteConfirm={deleteConfirm}
            description={`Delete "${displayTitle(pendingDelete?.title)}"? This can't be undone.`}
            isLoading={isDeleting}
          />
        </TransparentPopoverContent>
      </Popover>
    </div>
  );
};
