/** Fixed list route; the detail view's Back always returns here. */
export const MESSAGE_HISTORY_ROUTE = "/toggle/settings/history";

/**
 * Route state carried from Toggle Settings → "Continue chat" to the main bar.
 * Navigating to Settings unmounts the main chat, so the choice travels with
 * the navigation and is applied once the chat has mounted again.
 */
export interface ContinueConversationState {
  continueConversationId: string;
}

export const continueConversationState = (
  conversationId: string
): ContinueConversationState => ({ continueConversationId: conversationId });

export const readContinueConversationId = (state: unknown): string | null => {
  const id = (state as Partial<ContinueConversationState> | null)?.continueConversationId;
  return typeof id === "string" && id !== "" ? id : null;
};
