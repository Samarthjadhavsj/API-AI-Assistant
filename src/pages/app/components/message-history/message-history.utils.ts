import type { ChatConversation, ChatMessage } from "@/types/completion";

const MAX_TITLE_LENGTH = 120;

/**
 * Conversation titles are the first user message verbatim and can be
 * thousands of characters long. Collapse whitespace and cap the length so a
 * single title can't blow up list rows, headers, or dialog copy.
 */
export const displayTitle = (title: string | undefined | null) => {
  const normalized = (title ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled conversation";
  return normalized.length > MAX_TITLE_LENGTH
    ? `${normalized.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
    : normalized;
};

export const pluralize = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * When a conversation last had activity: the newer of its `updatedAt` and its
 * newest message. The stored `updated_at` is maintained by a DB trigger on
 * message inserts, so it normally equals the newest message — taking the max
 * keeps the order right even if the two ever drift.
 */
export const lastActivityAt = (conversation: ChatConversation): number =>
  conversation.messages.reduce(
    (latest, message) => Math.max(latest, message.timestamp),
    conversation.updatedAt || 0
  );

/**
 * Recent-first order for conversation lists: most recent activity on top,
 * oldest at the bottom. Equal timestamps fall back to id (descending) so the
 * order is deterministic. Returns a new array; the input and each
 * conversation's messages (oldest → newest) are left untouched.
 */
export const sortConversationsByRecent = (
  conversations: readonly ChatConversation[]
): ChatConversation[] =>
  [...conversations].sort(
    (a, b) =>
      lastActivityAt(b) - lastActivityAt(a) ||
      (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );

/** A question and the answer(s) that followed it, oldest → newest. */
export interface Exchange {
  key: string;
  messages: ChatMessage[];
}

/**
 * Message History presentation: groups a conversation into question → answer
 * exchanges and lists the newest exchange first, each question still directly
 * followed by its own answer. Works on a sorted copy (stable, so ties keep
 * their stored order); the stored messages are never mutated or reordered.
 */
export const exchangesNewestFirst = (messages: readonly ChatMessage[]): Exchange[] => {
  const chronological = messages
    .filter((message) => message.role !== "system")
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);
  const exchanges: Exchange[] = [];
  chronological.forEach((message, index) => {
    const current = exchanges[exchanges.length - 1];
    // A question opens an exchange; answers join the question before them.
    if (message.role === "user" || !current) {
      exchanges.push({ key: message.id || `exchange_${index}`, messages: [message] });
    } else {
      current.messages.push(message);
    }
  });
  return exchanges.reverse();
};
