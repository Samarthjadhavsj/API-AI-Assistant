import { MessageSquareText, Plus, XIcon } from "lucide-react";
import { Popover, PopoverTrigger, Button, ScrollArea } from "@/components";
import { TransparentPopoverContent } from "@/components/ui/popover";
import { ChatMessage } from "@/types/completion";
import { useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { useChatAutoScroll } from "@/hooks/useChatAutoScroll";
import { getResponseSettings } from "@/lib/storage/response-settings.storage";
import {
  ConversationTranscript,
  type LiveExchange,
} from "@/pages/app/components/message-history/ConversationTranscript";
import { HistoryEmpty } from "@/pages/app/components/message-history/HistoryStates";
import { displayTitle } from "@/pages/app/components/message-history/message-history.utils";

interface MessageHistoryProps {
  conversationHistory: ChatMessage[];
  currentConversationId: string | null;
  /** The question just sent, until its exchange is saved to history. */
  pendingMessage?: ChatMessage | null;
  /** The answer to `pendingMessage` as it streams in. */
  response?: string;
  isLoading?: boolean;
  onStartNewConversation: () => void;
  messageHistoryOpen: boolean;
  setMessageHistoryOpen: (open: boolean) => void;
  /**
   * Hides the icon (while answering or recording) without unmounting, so the
   * drawer keeps the reading position it remembers.
   */
  hidden?: boolean;
  /** Called after the drawer closes: by its icon, or any other way. */
  onClosed?: (how: "icon" | "other") => void;
}

/** Where the reader left a conversation's thread, and what the thread held then. */
interface SavedScroll {
  threadKey: string;
  scrollTop: number;
}

const NO_MESSAGES: ChatMessage[] = [];
const VIEWPORT = "[data-radix-scroll-area-viewport]";

/** The main bar's voice/text input (inside the response panel's anchor). */
const MAIN_SEARCH_BAR = '[data-slot="popover-anchor"] [data-voice-state]';

const headerButton =
  "h-7 shrink-0 gap-1 rounded-full px-2.5 text-xs font-medium [&_svg]:size-3.5";

/** Keys that scroll the transcript while focus is anywhere in the drawer. */
const SCROLL_KEYS: Record<string, (viewport: HTMLElement) => number> = {
  ArrowDown: () => 100,
  ArrowUp: () => -100,
  PageDown: (viewport) => viewport.clientHeight * 0.9,
  PageUp: (viewport) => -viewport.clientHeight * 0.9,
};

// Follows streamed text only while the reader is at the newest exchange (the
// same Auto-scroll setting as the answer panel).
const isFollowEnabled = () => getResponseSettings().autoScroll;

/**
 * Main bar → Message History: one compact drawer showing only the active
 * conversation in Conversation Mode style, read straight from the completion
 * state (no second copy, no database reads), newest exchange first. A question
 * being answered appears at the top with its answer streaming beneath it.
 * Opening or closing it never touches the draft, answer, attachments, or voice
 * state, and reopening returns to where the reader left off. Browsing and
 * managing every conversation lives in Toggle Settings → Message History.
 */
export const MessageHistory = ({
  conversationHistory,
  currentConversationId,
  pendingMessage = null,
  response = "",
  isLoading = false,
  onStartNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
  hidden = false,
  onClosed,
}: MessageHistoryProps) => {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLElement>(null);
  // Reading position per conversation, kept in memory only while the main bar
  // is mounted. The drawer's content unmounts on close, so this is what lets
  // a reopen return to the same spot.
  const savedScrollRef = useRef(new Map<string, SavedScroll>());

  // Ordering is the transcript's job (newest exchange first, on a copy).
  const messages = useMemo(
    () => conversationHistory.filter((message) => message.role !== "system"),
    [conversationHistory]
  );
  const savedMessages = currentConversationId !== null ? messages : NO_MESSAGES;
  const live = useMemo<LiveExchange | null>(
    () =>
      pendingMessage
        ? { question: pendingMessage, answer: response, isGenerating: isLoading }
        : null,
    [pendingMessage, response, isLoading]
  );
  const hasConversation = savedMessages.length > 0 || live !== null;
  // Conversations are titled after their first question (see useCompletion).
  const title = displayTitle(
    savedMessages
      .filter((message) => message.role === "user")
      .reduce<ChatMessage | undefined>((first, m) => (!first || m.timestamp < first.timestamp ? m : first), undefined)
      ?.content ?? pendingMessage?.content
  );
  const conversationSlot = currentConversationId ?? "new";
  // What the thread holds. A saved position only applies to the same thread:
  // after a new question or answer (or in another conversation) the drawer
  // opens at the newest exchange instead.
  const threadKey = `${conversationSlot}:${savedMessages.length}:${pendingMessage?.id ?? ""}`;
  const threadRef = useRef({ conversationSlot, threadKey });
  threadRef.current = { conversationSlot, threadKey };

  // Same rules as the answer panel, anchored at the top where the newest
  // exchange is: each send shows it; streamed text is followed only while the
  // reader is there, so reading older messages is never interrupted; switching
  // conversations starts at its newest exchange. Opening doesn't scroll: a
  // fresh thread already starts at the top, and a reopen restores its spot.
  useChatAutoScroll({
    scrollAreaRef,
    isOpen: messageHistoryOpen,
    isLoading,
    contentKey: `${savedMessages.length}:${pendingMessage?.id ?? ""}:${response.length}`,
    conversationKey: currentConversationId,
    isFollowEnabled,
    anchor: "top",
  });

  // Runs when the drawer's scroll area mounts, before it is painted: return to
  // the saved spot if the thread is unchanged (no visible jump), otherwise stay
  // at the top, where the newest exchange is.
  const attachScrollArea = useCallback((root: HTMLDivElement | null) => {
    scrollAreaRef.current = root;
    const viewport = root?.querySelector<HTMLElement>(VIEWPORT);
    if (!viewport) return;
    const { conversationSlot: slot, threadKey: key } = threadRef.current;
    const saved = savedScrollRef.current.get(slot);
    if (saved?.threadKey === key) viewport.scrollTop = saved.scrollTop;
  }, []);

  // Set by the icon's click just before Radix toggles the drawer closed.
  const closingFromIconRef = useRef(false);

  // Every way of closing (Close, Escape, the icon, clicking away) goes through
  // here while the content is still mounted, so the position can be read.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      const how = closingFromIconRef.current ? "icon" : "other";
      closingFromIconRef.current = false;
      if (!open) {
        const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(VIEWPORT);
        if (viewport) {
          const { conversationSlot: slot, threadKey: key } = threadRef.current;
          savedScrollRef.current.set(slot, { threadKey: key, scrollTop: viewport.scrollTop });
        }
      }
      setMessageHistoryOpen(open);
      if (!open) onClosed?.(how);
    },
    [setMessageHistoryOpen, onClosed]
  );

  const close = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  const handleNewChat = useCallback(() => {
    onStartNewConversation();
    close();
    // A new chat starts fresh: forget every remembered position.
    savedScrollRef.current.clear();
  }, [onStartNewConversation, close]);

  // Scroll the transcript from the keyboard. Handled here (and kept from
  // bubbling) so the response panel's own arrow-key scrolling underneath
  // doesn't take over while this drawer has focus.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const scrollBy = SCROLL_KEYS[event.key];
    if (!scrollBy) return;
    event.stopPropagation();
    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(VIEWPORT);
    if (!viewport) return;
    event.preventDefault();
    viewport.scrollBy({ top: scrollBy(viewport), behavior: "smooth" });
  };

  return (
    <div className="relative mt-1 shrink-0" hidden={hidden}>
      <Popover open={messageHistoryOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="size-8 cursor-pointer"
            aria-label="Message History"
            onClick={() => {
              closingFromIconRef.current = messageHistoryOpen;
            }}
            title="Message History (current conversation)"
            data-tauri-drag-region={false}
          >
            <MessageSquareText className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        {/* Message count of the current conversation */}
        {savedMessages.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary-foreground text-primary rounded-full h-5 w-5 flex border border-primary items-center justify-center text-xs font-medium pointer-events-none">
            {savedMessages.length}
          </div>
        )}

        <TransparentPopoverContent
          align="end"
          side="bottom"
          className="select-none w-screen p-0 mt-3 overflow-hidden rounded-2xl border border-input/40"
          aria-label="Current conversation"
          data-message-history="current"
          onKeyDown={handleKeyDown}
          // Start on the transcript, not a header action, so Enter can't
          // start a new chat by accident and arrow keys scroll right away.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            messagesRef.current?.focus();
          }}
          // Clicking, focusing or typing in the main search bar keeps this one
          // drawer open (the input is also refocused after each answer). Its
          // buttons (e.g. the mic), clicks elsewhere, and Escape still close it.
          onPointerDownOutside={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest(MAIN_SEARCH_BAR) &&
              !target.closest("button")
            ) {
              event.preventDefault();
            }
          }}
          onFocusOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest(MAIN_SEARCH_BAR)) {
              event.preventDefault();
            }
          }}
        >
          {/* One compact header; everything else is the conversation. */}
          <header className="flex h-9 items-center gap-1 border-b border-border/40 pl-3 pr-1.5">
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground" title={title}>
              {hasConversation ? title : "New conversation"}
            </p>
            {hasConversation && (
              <Button
                className={headerButton}
                data-tauri-drag-region={false}
                onClick={handleNewChat}
                size="sm"
                title="Start a new chat"
                variant="secondary"
              >
                <Plus />
                New chat
              </Button>
            )}
            <Button
              aria-label="Close Message History"
              className="size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              data-tauri-drag-region={false}
              onClick={close}
              size="icon"
              title="Close (Esc)"
              variant="ghost"
            >
              <XIcon className="size-4" />
            </Button>
          </header>

          <section
            aria-label={hasConversation ? "Messages" : "No messages"}
            className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            ref={messagesRef}
            tabIndex={0}
          >
            {/* Radix ScrollArea wraps content in a display:table div that grows
                to the widest child; make it a block so everything wraps/truncates
                within the 600px window instead of scrolling sideways. */}
            <ScrollArea
              className="h-[calc(100vh-8rem)] [&_[data-radix-scroll-area-viewport]>div]:!block"
              ref={attachScrollArea}
            >
              {hasConversation ? (
                <div className="px-2 py-2">
                  <ConversationTranscript live={live} messages={savedMessages} />
                </div>
              ) : (
                <HistoryEmpty
                  description="Ask Frank anything — this conversation will show up here."
                  title="No conversation yet"
                />
              )}
            </ScrollArea>
          </section>

        </TransparentPopoverContent>
      </Popover>
    </div>
  );
};
