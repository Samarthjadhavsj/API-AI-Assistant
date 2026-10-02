import { getDatabase } from "./config";
import type { AttachedFile } from "@/types/completion";

/** An image to send again: its base64 data and real MIME type. */
export interface StoredImage {
  data: string;
  mimeType: string;
}

interface DbAttachmentData {
  id: string;
  mime_type: string;
  data: string;
}

// Logs what failed, never the attachment contents.
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Keeps the image data of a message's attachments, scoped to its conversation,
 * so later messages can send the images again. Text files aren't stored here:
 * their text is already saved with the message. Saving the same attachment
 * twice is a no-op.
 */
export async function saveAttachmentData(
  conversationId: string,
  messageId: string,
  attachments: AttachedFile[]
): Promise<void> {
  const images = attachments.filter(
    (file) => file.kind === "image" && typeof file.base64 === "string" && file.base64 !== ""
  );
  if (images.length === 0) return;

  try {
    const db = await getDatabase();
    const createdAt = Date.now();
    for (const image of images) {
      await db.execute(
        "INSERT OR IGNORE INTO message_attachments (conversation_id, id, message_id, name, mime_type, kind, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [conversationId, image.id, messageId, image.name, image.type, "image", image.size, image.base64, createdAt]
      );
    }
  } catch (error) {
    console.error("Failed to keep attachment data:", reason(error));
  }
}

/**
 * The stored images of one conversation, by attachment id. Only this
 * conversation's rows are read; nothing is loaded for other conversations.
 */
export async function getAttachmentData(conversationId: string): Promise<Map<string, StoredImage>> {
  const images = new Map<string, StoredImage>();
  try {
    const db = await getDatabase();
    const rows = await db.select<DbAttachmentData[]>(
      "SELECT id, mime_type, data FROM message_attachments WHERE conversation_id = ?",
      [conversationId]
    );
    for (const row of rows ?? []) {
      images.set(row.id, { data: row.data, mimeType: row.mime_type });
    }
  } catch (error) {
    console.error("Failed to load attachment data:", reason(error));
  }
  return images;
}

/** Removes a conversation's stored attachment data (when it is deleted). */
export async function deleteAttachmentData(conversationId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM message_attachments WHERE conversation_id = ?", [conversationId]);
}

/** Removes all stored attachment data (Delete All). */
export async function deleteAllAttachmentData(): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM message_attachments");
}
