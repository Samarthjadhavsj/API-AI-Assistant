// Completion-related types
export interface AttachedFile {
  id: string;
  name: string;
  /** MIME type. For images, the format detected from the file's content. */
  type: string;
  /** Image data; empty for text files and for images stored in history. */
  base64: string;
  /** Size in bytes. */
  size: number;
  /** How the file is sent: as an image part, or as text in the message. Missing on older records (images). */
  kind?: "image" | "text";
  /** Contents of a text/code file. */
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** What was attached; image data is not kept (see toStoredAttachments). */
  attachedFiles?: AttachedFile[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface CompletionState {
  input: string;
  response: string;
  isLoading: boolean;
  error: string | null;
  attachedFiles: AttachedFile[];
  currentConversationId: string | null;
  conversationHistory: ChatMessage[];
}

// Provider-related types
export interface Message {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
        source?: any;
        inline_data?: any;
      }>;
}
