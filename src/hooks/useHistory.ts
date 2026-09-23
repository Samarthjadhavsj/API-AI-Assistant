import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllConversations,
  deleteConversation,
  deleteAllConversations,
  DOWNLOAD_SUCCESS_DISPLAY_MS,
} from "@/lib";
import { ChatConversation } from "@/types/completion";

export type UseHistoryType = ReturnType<typeof useHistory>;

export interface UseHistoryReturn {
  // State
  conversations: ChatConversation[];
  selectedConversationId: string | null;
  viewingConversation: ChatConversation | null;
  downloadedConversations: Set<string>;
  deleteConfirm: string | null;
  deleteAllConfirm: boolean;
  isDeleting: boolean;
  isDownloaded: boolean;
  isAttached: boolean;

  // Actions
  handleViewConversation: (conversation: ChatConversation) => void;
  handleDownloadConversation: (
    conversation: ChatConversation,
    e: React.MouseEvent
  ) => void;
  handleDeleteConfirm: (conversationId: string) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  handleDeleteAllConfirm: () => void;
  confirmDeleteAll: () => Promise<void>;
  cancelDeleteAll: () => void;
  handleAttachToOverlay: (conversationId: string) => void;
  handleDownload: (
    conversation: ChatConversation | null,
    e: React.MouseEvent
  ) => void;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  // Utilities
  refreshConversations: () => void;
  isLoading: boolean;
}

export interface UseHistoryOptions {
  /**
   * Load conversations on mount (default). Surfaces that stay mounted but are
   * rarely shown, like the overlay's history popover, pass `false` and call
   * `refreshConversations` when they open.
   */
  autoLoad?: boolean;
}

export function useHistory({
  autoLoad = true,
}: UseHistoryOptions = {}): UseHistoryReturn {
  // Starts true when auto-loading so consumers don't flash an empty state
  // before the first load
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [viewingConversation, setViewingConversation] =
    useState<ChatConversation | null>(null);

  const [downloadedConversations, setDownloadedConversations] = useState<
    Set<string>
  >(new Set());

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Ref guard so a second delete can't start before React re-renders
  const isDeletingRef = useRef(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isAttached, setIsAttached] = useState(false);

  // Function to refresh conversations
  const refreshConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedConversations = await getAllConversations();
      setConversations(loadedConversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load conversations when the component mounts (unless the caller opts out)
  useEffect(() => {
    if (autoLoad) refreshConversations();
  }, [autoLoad, refreshConversations]);

  const handleViewConversation = (conversation: ChatConversation) => {
    setViewingConversation(conversation);
  };

  const handleDownloadConversation = (
    conversation: ChatConversation,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    // Show download success state
    setDownloadedConversations((prev) => new Set(prev).add(conversation.id));

    try {
      // Convert conversation to markdown format
      const markdown = generateConversationMarkdown(conversation);

      // Create and download the file
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = generateFilename(conversation.title);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download conversation:", error);
      // Remove from success state if download failed
      setDownloadedConversations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(conversation.id);
        return newSet;
      });
      return;
    }

    // Clear success state after display timeout
    setTimeout(() => {
      setDownloadedConversations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(conversation.id);
        return newSet;
      });
    }, DOWNLOAD_SUCCESS_DISPLAY_MS);
  };

  const handleDeleteConfirm = (conversationId: string) => {
    setDeleteConfirm(conversationId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || isDeletingRef.current) return;

    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      setSelectedConversationId(null);
      setViewingConversation(null);
      await deleteConversation(deleteConfirm);
      setConversations((prev) => prev.filter((c) => c.id !== deleteConfirm));

      // Emit event to notify other components about deletion
      window.dispatchEvent(
        new CustomEvent("conversationDeleted", {
          detail: deleteConfirm,
        })
      );
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleDeleteAllConfirm = () => {
    setDeleteAllConfirm(true);
  };

  const confirmDeleteAll = async () => {
    if (isDeletingRef.current) return;

    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      setSelectedConversationId(null);
      setViewingConversation(null);
      await deleteAllConversations();
      setConversations([]);

      // Lets an active conversation in the main input reset itself
      window.dispatchEvent(new CustomEvent("conversationsCleared"));
    } catch (error) {
      console.error("Failed to delete all conversations:", error);
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
      setDeleteAllConfirm(false);
    }
  };

  const cancelDeleteAll = () => {
    setDeleteAllConfirm(false);
  };

  const handleAttachToOverlay = (conversationId: string) => {
    // Use localStorage to communicate between windows
    localStorage.setItem(
      "hey-frank-conversation-selected",
      JSON.stringify({ id: conversationId, timestamp: Date.now() })
    );
    setIsAttached(true);
    setTimeout(() => {
      setIsAttached(false);
    }, DOWNLOAD_SUCCESS_DISPLAY_MS);
  };

  const handleDownload = (
    conversation: ChatConversation | null,
    e: React.MouseEvent
  ) => {
    if (conversation) {
      handleDownloadConversation(conversation, e);
      setIsDownloaded(true);
      setTimeout(() => {
        setIsDownloaded(false);
      }, DOWNLOAD_SUCCESS_DISPLAY_MS);
    }
  };

  // Helper functions
  const generateConversationMarkdown = (
    conversation: ChatConversation
  ): string => {
    let markdown = `# ${conversation.title}\n\n`;
    markdown += `**Created:** ${new Date(
      conversation.createdAt
    ).toLocaleString()}\n`;
    markdown += `**Updated:** ${new Date(
      conversation.updatedAt
    ).toLocaleString()}\n`;
    markdown += `**Messages:** ${conversation.messages.length}\n\n---\n\n`;

    conversation.messages.forEach((message, index) => {
      const roleLabel = message.role.toUpperCase();
      markdown += `## ${roleLabel}: ${message.content}\n`;

      if (index < conversation.messages.length - 1) {
        markdown += "\n";
      }
    });

    return markdown;
  };

  const generateFilename = (title: string): string => {
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return `${sanitizedTitle.substring(0, 16)}.md`;
  };

  return {
    // State
    conversations,
    selectedConversationId,
    viewingConversation,
    downloadedConversations,
    deleteConfirm,
    deleteAllConfirm,
    isDeleting,
    isDownloaded,
    isAttached,

    // Actions
    handleViewConversation,
    handleDownloadConversation,
    handleDeleteConfirm,
    confirmDelete,
    cancelDelete,
    handleDeleteAllConfirm,
    confirmDeleteAll,
    cancelDeleteAll,
    handleAttachToOverlay,
    handleDownload,
    // Utilities
    refreshConversations,
    search,
    setSearch,
    isLoading,
  };
}
