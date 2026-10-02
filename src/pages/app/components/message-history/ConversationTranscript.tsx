import { useMemo } from "react";
import type { ChatMessage } from "@/types/completion";
import { ThreadGenerating, ThreadMessage } from "@/pages/app/components/completion/ThreadMessage";
import { exchangesNewestFirst } from "./message-history.utils";

/** The question just sent and its answer so far, before they are saved. */
export interface LiveExchange {
  question: ChatMessage;
  answer: string;
  isGenerating: boolean;
}

interface ConversationTranscriptProps {
  messages: ChatMessage[];
  live?: LiveExchange | null;
}

interface TranscriptEntry {
  message: ChatMessage;
  /** The answer streaming in for the live question. */
  isStreaming?: boolean;
}

/**
 * The current conversation in Conversation Mode style (the same messages as
 * the answer panel's Conversation Mode), newest exchange first: the latest
 * question on top with its answer directly underneath, then older exchanges.
 * A live exchange (the question just sent and its streaming answer) always
 * goes on top. Presentation only — `messages` is never mutated or reordered.
 */
export const ConversationTranscript = ({ messages, live }: ConversationTranscriptProps) => {
  const entries = useMemo(() => {
    const list: TranscriptEntry[] = exchangesNewestFirst(messages).flatMap((exchange) =>
      exchange.messages.map((message) => ({ message }))
    );
    if (live) {
      const liveEntries: TranscriptEntry[] = [{ message: live.question }];
      if (live.answer || live.isGenerating) {
        liveEntries.push({
          message: {
            id: `${live.question.id}_answer`,
            role: "assistant",
            content: live.answer,
            timestamp: live.question.timestamp,
          },
          isStreaming: live.isGenerating,
        });
      }
      list.unshift(...liveEntries);
    }
    return list;
  }, [messages, live]);

  return (
    <ol
      aria-label="Conversation"
      className="min-w-0 select-text space-y-1 break-words [overflow-wrap:anywhere]"
    >
      {entries.map(({ message, isStreaming }, index) =>
        isStreaming && !message.content ? (
          <ThreadGenerating as="li" key={message.id || index} />
        ) : (
          <ThreadMessage as="li" isStreaming={isStreaming} key={message.id || index} message={message} />
        )
      )}
    </ol>
  );
};
