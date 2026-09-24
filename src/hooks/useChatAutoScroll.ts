import { useCallback, useEffect, useRef, type RefObject } from "react";

/** How close to the bottom (px) still counts as "reading the latest". */
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
}

/**
 * Keeps a chat panel pinned to its newest message without fighting the reader:
 * - sending a message always brings the newest exchange into view;
 * - streamed text is followed only while the reader is at (or near) the bottom;
 * - scrolling up to read older messages is left alone until the next send;
 * - loading a different conversation starts at its latest exchange.
 */
export function useChatAutoScroll({
  scrollAreaRef,
  isOpen,
  isLoading,
  contentKey,
  conversationKey,
  isFollowEnabled,
}: UseChatAutoScrollOptions) {
  const stickToBottomRef = useRef(true);
  const wasLoadingRef = useRef(isLoading);
  const isFollowEnabledRef = useRef(isFollowEnabled);
  isFollowEnabledRef.current = isFollowEnabled;

  const getViewport = useCallback(
    () => scrollAreaRef.current?.querySelector<HTMLElement>(VIEWPORT_SELECTOR) ?? null,
    [scrollAreaRef]
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior) => {
      // Wait a frame so the newest content is laid out first.
      requestAnimationFrame(() => {
        const viewport = getViewport();
        viewport?.scrollTo({ top: viewport.scrollHeight, behavior });
      });
    },
    [getViewport]
  );

  // Track whether the reader is at the bottom. Only real scrolling changes this;
  // content growing underneath a pinned reader keeps them pinned.
  useEffect(() => {
    if (!isOpen) return;
    let viewport: HTMLElement | null = null;
    const handleScroll = () => {
      if (!viewport) return;
      const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      stickToBottomRef.current = distance <= NEAR_BOTTOM_THRESHOLD;
    };
    const frame = requestAnimationFrame(() => {
      viewport = getViewport();
      viewport?.addEventListener("scroll", handleScroll, { passive: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen, getViewport]);

  // A new message was sent: always show the newest exchange.
  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      stickToBottomRef.current = true;
      scrollToBottom("smooth");
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, scrollToBottom]);

  // Streaming / new content: follow only while the reader is at the bottom.
  // Instant (not smooth) so the follow never lags behind fast streams.
  useEffect(() => {
    if (!stickToBottomRef.current || !isFollowEnabledRef.current()) return;
    scrollToBottom("auto");
  }, [contentKey, scrollToBottom]);

  // A different conversation was loaded: start at its latest exchange.
  useEffect(() => {
    stickToBottomRef.current = true;
    scrollToBottom("auto");
  }, [conversationKey, scrollToBottom]);
}
