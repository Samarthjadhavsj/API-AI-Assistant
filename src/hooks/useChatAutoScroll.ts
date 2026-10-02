import { useCallback, useEffect, useRef, type RefObject } from "react";

/** How close to the newest edge (px) still counts as "reading the latest". */
export const NEAR_BOTTOM_THRESHOLD = 80;

const VIEWPORT_SELECTOR = "[data-radix-scroll-area-viewport]";

interface UseChatAutoScrollOptions {
  /** Ref on the Radix ScrollArea root that holds the conversation. */
  scrollAreaRef: RefObject<HTMLElement | null>;
  /** Whether the panel (and so its viewport) is currently mounted. */
  isOpen: boolean;
  /** True while an answer is being generated. */
  isLoading: boolean;
  /** Changes whenever the rendered content grows (e.g. streamed text). */
  contentKey: unknown;
  /** Changes when a different conversation is loaded. */
  conversationKey: unknown;
  /** Whether following streamed text is enabled (the Auto-scroll setting). */
  isFollowEnabled: () => boolean;
  /**
   * Where the newest message is: "bottom" for chronological chats (default),
   * "top" for newest-first lists such as Message History.
   */
  anchor?: "bottom" | "top";
}

/**
 * Keeps a chat panel pinned to its newest message without fighting the reader:
 * - sending a message always brings the newest exchange into view;
 * - streamed text is followed only while the reader is at (or near) the
 *   newest edge (the bottom, or the top for newest-first lists);
 * - scrolling away to read older messages is left alone until the next send;
 * - loading a different conversation starts at its latest exchange.
 */
export function useChatAutoScroll({
  scrollAreaRef,
  isOpen,
  isLoading,
  contentKey,
  conversationKey,
  isFollowEnabled,
  anchor = "bottom",
}: UseChatAutoScrollOptions) {
  const stickToNewestRef = useRef(true);
  const wasLoadingRef = useRef(isLoading);
  const isFollowEnabledRef = useRef(isFollowEnabled);
  isFollowEnabledRef.current = isFollowEnabled;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const getViewport = useCallback(
    () => scrollAreaRef.current?.querySelector<HTMLElement>(VIEWPORT_SELECTOR) ?? null,
    [scrollAreaRef]
  );

  const scrollToNewest = useCallback(
    (behavior: ScrollBehavior) => {
      // Nothing to scroll while closed. (A request left pending would otherwise
      // land on the panel's next opening and undo a restored position.)
      if (!isOpenRef.current) return;
      // Wait a frame so the newest content is laid out first.
      requestAnimationFrame(() => {
        const viewport = getViewport();
        viewport?.scrollTo({ top: anchor === "top" ? 0 : viewport.scrollHeight, behavior });
      });
    },
    [getViewport, anchor]
  );

  // Track whether the reader is at the newest edge. Only real scrolling changes this;
  // content growing underneath a pinned reader keeps them pinned.
  useEffect(() => {
    if (!isOpen) return;
    let viewport: HTMLElement | null = null;
    const handleScroll = () => {
      if (!viewport) return;
      const distance =
        anchor === "top"
          ? viewport.scrollTop
          : viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      stickToNewestRef.current = distance <= NEAR_BOTTOM_THRESHOLD;
    };
    const frame = requestAnimationFrame(() => {
      viewport = getViewport();
      viewport?.addEventListener("scroll", handleScroll, { passive: true });
      // A top-anchored list opens at the top (its newest message) or wherever
      // its owner restored it, so start from the actual position. (A bottom-
      // anchored panel is scrolled to its newest message after opening.)
      if (anchor === "top") handleScroll();
    });
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen, getViewport, anchor]);

  // A new message was sent: always show the newest exchange.
  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      stickToNewestRef.current = true;
      scrollToNewest("smooth");
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, scrollToNewest]);

  // Streaming / new content: follow only while the reader is at the newest edge.
  // Instant (not smooth) so the follow never lags behind fast streams.
  useEffect(() => {
    if (!stickToNewestRef.current || !isFollowEnabledRef.current()) return;
    scrollToNewest("auto");
  }, [contentKey, scrollToNewest]);

  // A different conversation was loaded: start at its latest exchange.
  useEffect(() => {
    stickToNewestRef.current = true;
    scrollToNewest("auto");
  }, [conversationKey, scrollToNewest]);
}
