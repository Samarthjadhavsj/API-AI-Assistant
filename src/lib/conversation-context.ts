import type { Message, TYPE_PROVIDER } from "@/types";
import type { AttachedFile, ChatMessage } from "@/types/completion";
import {
  buildPromptWithTextFiles,
  imageLimitsFor,
  isImageAttachment,
  type ImageMimeType,
} from "./attachments";

/** An image kept for the conversation: its data and real MIME type. */
export interface ConversationImage {
  data: string;
  mimeType: string;
}

/** An earlier image that couldn't go with this request, and why. */
export interface OmittedImage {
  name: string;
  reason: string;
  /** Sent before images were kept with conversations: nothing to send. */
  notKept?: boolean;
}

export interface ConversationContext {
  history: Message[];
  omitted: OmittedImage[];
}

/** The well-formed image attachments of a message, in their original order. */
const imageAttachmentsOf = (message: ChatMessage): AttachedFile[] =>
  Array.isArray(message.attachedFiles)
    ? message.attachedFiles.filter(
        (file): file is AttachedFile =>
          !!file && typeof file.id === "string" && typeof file.name === "string" && isImageAttachment({
            kind: file.kind,
            type: typeof file.type === "string" ? file.type : "",
          })
      )
    : [];

const quoted = (files: AttachedFile[]) => files.map((f) => `"${f.name}"`).join(", ");

/**
 * Rebuilds the conversation so far for a provider request. Providers keep no
 * conversation state, so every request carries it again:
 * - each earlier user message keeps its own attachments: text files inline
 *   (as when it was sent), images attached to that same message, labelled by
 *   name so several images stay distinguishable;
 * - images are checked against what the provider accepts (image support,
 *   formats, per-image size, and the request's total), newest first, after the
 *   images of the message being sent;
 * - an image that can't go is never dropped silently: its message says which
 *   image is missing and why, and it is reported in `omitted`.
 * Answers are sent as they were. `messages` is never mutated.
 */
export const buildConversationContext = ({
  messages,
  images,
  provider,
  currentImageBytes = 0,
}: {
  /** The conversation so far, oldest first, as stored. */
  messages: readonly ChatMessage[];
  /** This conversation's kept image data, by attachment id. */
  images: ReadonlyMap<string, ConversationImage>;
  provider: TYPE_PROVIDER;
  /** Size of the images attached to the message being sent. */
  currentImageBytes?: number;
}): ConversationContext => {
  const limits = imageLimitsFor(provider);

  // Decide per image, newest message first, so the most recent images get the
  // request's image budget before older ones.
  const skipped = new Map<string, OmittedImage>();
  let budget =
    limits.maxTotalImageBytes !== undefined
      ? limits.maxTotalImageBytes - currentImageBytes
      : Number.POSITIVE_INFINITY;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    for (const file of imageAttachmentsOf(messages[i])) {
      const image = images.get(file.id);
      let reason: string | null = null;
      if (!image) reason = "it wasn't kept with this conversation";
      else if (!limits.supportsImages) reason = `${limits.name} can't read images`;
      else if (!limits.formats.includes(image.mimeType as ImageMimeType))
        reason = `${limits.name} doesn't accept this image format`;
      else if (file.size > limits.maxImageBytes) reason = `it's too large for ${limits.name}`;
      else if (file.size > budget) reason = `it doesn't fit in one request to ${limits.name} with the newer images`;
      else budget -= file.size;
      if (reason) skipped.set(file.id, { name: file.name, reason, ...(image ? {} : { notKept: true }) });
    }
  }

  const history: Message[] = messages.map((message) => {
    if (message.role !== "user") return { role: message.role, content: message.content };

    const text = buildPromptWithTextFiles(message.content, message.attachedFiles);
    const attached = imageAttachmentsOf(message);
    if (attached.length === 0) return { role: "user", content: text };

    const sent = attached.filter((file) => !skipped.has(file.id));
    const notes = [
      ...(sent.length > 0 ? [`[Attached image${sent.length > 1 ? "s" : ""}: ${quoted(sent)}]`] : []),
      ...attached
        .filter((file) => skipped.has(file.id))
        .map((file) => `[Image "${file.name}" was attached here but isn't included: ${skipped.get(file.id)!.reason}.]`),
    ];
    return {
      role: "user",
      content: `${notes.join("\n")}\n\n${text}`,
      ...(sent.length > 0
        ? { images: sent.map((file) => ({ ...images.get(file.id)! })) }
        : {}),
    };
  });

  return { history, omitted: [...skipped.values()].reverse() };
};

/** A short notice for the user when earlier images couldn't be sent (null otherwise). */
export const describeOmittedImages = (omitted: OmittedImage[]): string | null => {
  // Images from before they were kept can't be sent; that isn't news on every message.
  const reported = omitted.filter((image) => !image.notKept);
  if (reported.length === 0) return null;
  const list = reported.map((image) => `"${image.name}" (${image.reason})`).join(", ");
  return `Earlier image${reported.length > 1 ? "s" : ""} not sent with this message: ${list}.`;
};
