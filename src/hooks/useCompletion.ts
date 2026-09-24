import { useState, useCallback, useRef, useEffect } from "react";
import { useWindowResize } from "./useWindow";
import { useChatAutoScroll } from "./useChatAutoScroll";
import { useGlobalShortcuts } from "@/hooks";
import { invokeVoiceShortcutToggle } from "@/hooks/useVoiceInput";
import { MAX_FILES } from "@/config";
import { useApp } from "@/contexts";
import {
  fetchAIResponse,
  saveConversation,
  getConversationById,
  generateConversationTitle,
  MESSAGE_ID_OFFSET,
  generateConversationId,
  generateMessageId,
  generateRequestId,
  getResponseSettings,
} from "@/lib";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  base64ByteLength,
  buildPromptWithTextFiles,
  createAttachmentId,
  defaultPromptFor,
  isImageAttachment,
  isSameAttachment,
  readAttachment,
  toStoredAttachments,
  validateAttachmentsForProvider,
} from "@/lib/attachments";
import type { AttachedFile, ChatMessage } from "@/types/completion";

interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface CompletionState {
  input: string;
  response: string;
  isLoading: boolean;
  error: string | null;
  attachedFiles: AttachedFile[];
  currentConversationId: string | null;
  conversationHistory: ChatMessage[];
  /** The question just sent, shown until its exchange is saved to history. */
  pendingMessage: ChatMessage | null;
}

export const useCompletion = () => {
  const {
    selectedAIProvider,
    allAiProviders,
    systemPrompt,
    screenshotConfiguration,
    setScreenshotConfiguration,
  } = useApp();
  const globalShortcuts = useGlobalShortcuts();

  const [state, setState] = useState<CompletionState>({
    input: "",
    response: "",
    isLoading: false,
    error: null,
    attachedFiles: [],
    currentConversationId: null,
    conversationHistory: [],
    pendingMessage: null,
  });
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);
  const [isFilesPopoverOpen, setIsFilesPopoverOpen] = useState(false);
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);
  const [keepEngaged, setKeepEngaged] = useState(false);
  /** Why picked or pasted files weren't attached, shown in the attachments panel. */
  const [attachmentNotices, setAttachmentNotices] = useState<string[]>([]);
  /** Files still being read; a send waits for them. */
  const [pendingAttachmentReads, setPendingAttachmentReads] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isProcessingScreenshotRef = useRef(false);
  const screenshotConfigRef = useRef(screenshotConfiguration);
  const hasCheckedPermissionRef = useRef(false);
  const screenshotInitiatedByThisContext = useRef(false);

  const { resizeWindow } = useWindowResize();

  useEffect(() => {
    screenshotConfigRef.current = screenshotConfiguration;
  }, [screenshotConfiguration]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);

  const setInput = useCallback((value: string) => {
    setState((prev) => ({ ...prev, input: value }));
  }, []);

  const setResponse = useCallback((value: string) => {
    setState((prev) => ({ ...prev, response: value }));
  }, []);

  // Attachments as of the latest change, including files added since the last
  // render: reads finish asynchronously, so the file limit and duplicate checks
  // can't rely on the rendered state.
  const attachmentsRef = useRef<AttachedFile[]>(state.attachedFiles);
  const pendingReadsRef = useRef(0);
  // Bumped whenever attachments are cleared, so a read that finishes afterwards
  // doesn't bring a file back into a cleared composer or a new chat.
  const attachmentGenerationRef = useRef(0);
  // A send requested while files were still being read.
  const queuedSubmitRef = useRef<{ speechText?: string } | null>(null);

  useEffect(() => {
    attachmentsRef.current = state.attachedFiles;
  }, [state.attachedFiles]);

  const setPendingReads = (delta: number) => {
    pendingReadsRef.current += delta;
    setPendingAttachmentReads(pendingReadsRef.current);
  };

  const appendAttachment = useCallback((file: AttachedFile) => {
    attachmentsRef.current = [...attachmentsRef.current, file];
    setState((prev) => ({
      ...prev,
      attachedFiles: [...prev.attachedFiles, file],
    }));
  }, []);

  /** Drops every attachment, including files still being read. */
  const discardAttachments = useCallback(() => {
    attachmentGenerationRef.current += 1;
    attachmentsRef.current = [];
    queuedSubmitRef.current = null;
    setAttachmentNotices([]);
  }, []);

  /**
   * Checks, reads and attaches picked or pasted files. Files that can't be
   * attached are reported in the attachments panel; none are dropped silently.
   */
  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const generation = attachmentGenerationRef.current;
      const notices: string[] = [];

      const free = Math.max(
        0,
        MAX_FILES - attachmentsRef.current.length - pendingReadsRef.current
      );
      const accepted = files.slice(0, free);
      const overflow = files.slice(free);
      if (overflow.length > 0) {
        notices.push(
          `You can attach up to ${MAX_FILES} files. ${
            overflow.length === 1
              ? `"${overflow[0].name}" wasn't added.`
              : `${overflow.length} files weren't added: ${overflow
                  .map((f) => `"${f.name}"`)
                  .join(", ")}.`
          }`
        );
      }

      // Kept in the order the files were picked.
      const fileNotices: (string | null)[] = accepted.map(() => null);
      setPendingReads(accepted.length);
      await Promise.all(
        accepted.map(async (file, index) => {
          try {
            const result = await readAttachment(file);
            if (generation !== attachmentGenerationRef.current) return;
            if (!result.ok) {
              fileNotices[index] = result.reason;
              return;
            }
            if (attachmentsRef.current.some((f) => isSameAttachment(f, result.file))) {
              fileNotices[index] = `"${result.file.name}" is already attached.`;
              return;
            }
            appendAttachment(result.file);
          } catch (error) {
            console.error("[Attachments] Failed to attach file:", error);
            fileNotices[index] = `${file.name}: the file couldn't be attached.`;
          } finally {
            setPendingReads(-1);
          }
        })
      );

      if (generation !== attachmentGenerationRef.current) return;
      notices.push(...fileNotices.filter((n): n is string => n !== null));
      if (notices.length > 0) {
        setAttachmentNotices((prev) => [...prev, ...notices]);
        setIsFilesPopoverOpen(true);
      }
    },
    [appendAttachment]
  );

  const addFile = useCallback((file: File) => addFiles([file]), [addFiles]);

  const removeFile = useCallback((fileId: string) => {
    attachmentsRef.current = attachmentsRef.current.filter((f) => f.id !== fileId);
    setState((prev) => ({
      ...prev,
      attachedFiles: prev.attachedFiles.filter((f) => f.id !== fileId),
    }));
  }, []);

  const clearFiles = useCallback(() => {
    discardAttachments();
    setState((prev) => ({ ...prev, attachedFiles: [] }));
  }, [discardAttachments]);

  const dismissAttachmentNotices = useCallback(() => {
    setAttachmentNotices([]);
  }, []);

  const submit = useCallback(
    async (speechText?: string) => {
      // Files still being read would otherwise be left out of this message and
      // turn up attached to the next one: send once they're ready.
      if (pendingReadsRef.current > 0) {
        queuedSubmitRef.current = { speechText };
        return;
      }

      const input = speechText || state.input;
      const attachments = state.attachedFiles;

      // Allow submission if there's text OR attached files
      if (!input.trim() && attachments.length === 0) {
        return;
      }

      // If there's no text, ask about the attachments
      const userMessage = input.trim() || defaultPromptFor(attachments);

      if (speechText) {
        setState((prev) => ({
          ...prev,
          input: speechText,
        }));
      }

      // Generate unique request ID
      const requestId = generateRequestId();
      currentRequestIdRef.current = requestId;

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        // Prepare message history for the AI. Text files attached earlier in
        // the conversation are included again so follow-ups can refer to them.
        const messageHistory = state.conversationHistory.map((msg) => ({
          role: msg.role,
          content:
            msg.role === "user"
              ? buildPromptWithTextFiles(msg.content, msg.attachedFiles)
              : msg.content,
        }));

        // Images go as image parts with their real format; text and code
        // files go inside the message.
        const images = attachments
          .filter(isImageAttachment)
          .map((file) => ({ data: file.base64, mimeType: file.type }));
        const prompt = buildPromptWithTextFiles(userMessage, attachments);

        let fullResponse = "";

        // Check if AI provider is configured
        if (!selectedAIProvider.provider) {
          setState((prev) => ({
            ...prev,
            error: "Please select an AI provider in settings",
          }));
          return;
        }

        const provider = allAiProviders.find(
          (p) => p.id === selectedAIProvider.provider
        );
        if (!provider) {
          setState((prev) => ({
            ...prev,
            error: "Invalid provider selected",
          }));
          return;
        }

        // Catch what this provider can't accept before sending, with a message
        // that says what to change. The attachments and draft are kept.
        const attachmentError = validateAttachmentsForProvider(provider, attachments);
        if (attachmentError) {
          setState((prev) => ({ ...prev, error: attachmentError }));
          return;
        }

        // Clear previous response and set loading state
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
          response: "",
          pendingMessage: {
            id: `pending_${Date.now()}`,
            role: "user",
            content: userMessage,
            timestamp: Date.now(),
            ...(attachments.length > 0
              ? { attachedFiles: toStoredAttachments(attachments) }
              : {}),
          },
        }));

        try {
          // Use the fetchAIResponse function with signal
          for await (const chunk of fetchAIResponse({
            provider: provider,
            selectedProvider: selectedAIProvider,
            systemPrompt: systemPrompt || undefined,
            history: messageHistory,
            userMessage: prompt,
            images,
            signal,
          })) {
            // Only update if this is still the current request
            if (currentRequestIdRef.current !== requestId) {
              return; // Request was superseded, stop processing
            }

            // Check if request was aborted
            if (signal.aborted) {
              return; // Request was cancelled, stop processing
            }

            fullResponse += chunk;
            setState((prev) => ({
              ...prev,
              response: prev.response + chunk,
            }));
          }
        } catch (e: any) {
          // Only show error if this is still the current request and not aborted
          if (currentRequestIdRef.current === requestId && !signal.aborted) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: e.message || "An error occurred",
            }));
          }
          return;
        }

        // Only proceed if this is still the current request
        if (currentRequestIdRef.current !== requestId || signal.aborted) {
          return;
        }

        setState((prev) => ({ ...prev, isLoading: false }));

        // Focus input after AI response is complete
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);

        // Save the conversation after successful completion
        if (fullResponse) {
          await saveCurrentConversation(userMessage, fullResponse, attachments);
          // Clear the input and the files that were sent. A file added while
          // the answer streamed (e.g. a screenshot shortcut) stays attached.
          const sentIds = new Set(attachments.map((f) => f.id));
          attachmentsRef.current = attachmentsRef.current.filter(
            (f) => !sentIds.has(f.id)
          );
          setState((prev) => ({
            ...prev,
            input: "",
            attachedFiles: prev.attachedFiles.filter((f) => !sentIds.has(f.id)),
          }));
        }
      } catch (error) {
        // Only show error if not aborted
        if (!signal?.aborted && currentRequestIdRef.current === requestId) {
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "An error occurred",
            isLoading: false,
          }));
        }
      }
    },
    [
      state.input,
      state.attachedFiles,
      selectedAIProvider,
      allAiProviders,
      systemPrompt,
      state.conversationHistory,
    ]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    currentRequestIdRef.current = null;
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  const reset = useCallback(() => {
    // Don't reset if keep engaged mode is active
    if (keepEngaged) {
      return;
    }
    cancel();
    discardAttachments();
    setState((prev) => ({
      ...prev,
      input: "",
      response: "",
      error: null,
      attachedFiles: [],
      pendingMessage: null,
    }));
  }, [cancel, keepEngaged, discardAttachments]);

  // Note: saveConversation, getConversationById, and generateConversationTitle
  // are now imported from lib/database/chat-history.action.ts

  const loadConversation = useCallback((conversation: ChatConversation) => {
    // Find the last assistant message to display as response
    const lastAssistantMessage = conversation.messages
      .filter(msg => msg.role === 'assistant')
      .pop();
    
    setState((prev) => ({
      ...prev,
      currentConversationId: conversation.id,
      conversationHistory: conversation.messages,
      input: "",
      response: lastAssistantMessage?.content || "",
      error: null,
      isLoading: false,
      pendingMessage: null,
    }));
  }, []);

  const startNewConversation = useCallback(() => {
    discardAttachments();
    setState((prev) => ({
      ...prev,
      currentConversationId: null,
      conversationHistory: [],
      input: "",
      response: "",
      error: null,
      isLoading: false,
      attachedFiles: [],
      pendingMessage: null,
    }));
  }, [discardAttachments]);

  const saveCurrentConversation = useCallback(
    async (
      userMessage: string,
      assistantResponse: string,
      attachedFiles: AttachedFile[]
    ) => {
      // Validate inputs
      if (!userMessage || !assistantResponse) {
        console.error("Cannot save conversation: missing message content");
        return;
      }

      const conversationId =
        state.currentConversationId || generateConversationId("chat");
      const timestamp = Date.now();

      const userMsg: ChatMessage = {
        id: generateMessageId("user", timestamp),
        role: "user",
        content: userMessage,
        timestamp,
        // Names, sizes and text-file contents; image data isn't stored.
        ...(attachedFiles.length > 0
          ? { attachedFiles: toStoredAttachments(attachedFiles) }
          : {}),
      };

      const assistantMsg: ChatMessage = {
        id: generateMessageId("assistant", timestamp + MESSAGE_ID_OFFSET),
        role: "assistant",
        content: assistantResponse,
        timestamp: timestamp + MESSAGE_ID_OFFSET,
      };

      const newMessages = [...state.conversationHistory, userMsg, assistantMsg];

      // Get existing conversation if updating
      let existingConversation = null;
      if (state.currentConversationId) {
        try {
          existingConversation = await getConversationById(
            state.currentConversationId
          );
        } catch (error) {
          console.error("Failed to get existing conversation:", error);
        }
      }

      const title =
        state.conversationHistory.length === 0
          ? generateConversationTitle(userMessage)
          : existingConversation?.title ||
            generateConversationTitle(userMessage);

      const conversation: ChatConversation = {
        id: conversationId,
        title,
        messages: newMessages,
        createdAt: existingConversation?.createdAt || timestamp,
        updatedAt: timestamp,
      };

      try {
        await saveConversation(conversation);

        setState((prev) => ({
          ...prev,
          currentConversationId: conversationId,
          conversationHistory: newMessages,
          pendingMessage: null,
        }));
      } catch (error) {
        console.error("Failed to save conversation:", error);
        // Show error to user
        setState((prev) => ({
          ...prev,
          error: "Failed to save conversation. Please try again.",
        }));
      }
    },
    [state.currentConversationId, state.conversationHistory]
  );

  // Listen for conversation events from the main ChatHistory component
  useEffect(() => {
    const handleConversationSelected = async (event: any) => {
      console.log(event, "event");
      // Only the conversation ID is passed through the event
      const { id } = event.detail;
      console.log(id, "id");
      if (!id || typeof id !== "string") {
        console.error("No conversation ID provided");
        setState((prev) => ({
          ...prev,
          error: "Invalid conversation selected",
        }));
        return;
      }
      console.log(id, "id");
      try {
        // Fetch the full conversation from SQLite
        const conversation = await getConversationById(id);

        if (conversation) {
          loadConversation(conversation);
        } else {
          console.error(`Conversation ${id} not found in database`);
          setState((prev) => ({
            ...prev,
            error: "Conversation not found. It may have been deleted.",
          }));
        }
      } catch (error) {
        console.error("Failed to load conversation:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to load conversation. Please try again.",
        }));
      }
    };

    const handleNewConversation = () => {
      startNewConversation();
    };

    const handleConversationDeleted = (event: any) => {
      const deletedId = event.detail;
      // If the currently active conversation was deleted, start a new one
      if (state.currentConversationId === deletedId) {
        startNewConversation();
      }
    };

    const handleConversationsCleared = () => {
      if (state.currentConversationId) {
        startNewConversation();
      }
    };

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === "hey-frank-conversation-selected" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          const { id } = data;
          if (id && typeof id === "string") {
            const conversation = await getConversationById(id);
            if (conversation) {
              loadConversation(conversation);
            }
          }
        } catch (error) {
          console.error("Failed to parse conversation selection:", error);
        }
      }
    };

    window.addEventListener("conversationSelected", handleConversationSelected);
    window.addEventListener("newConversation", handleNewConversation);
    window.addEventListener("conversationDeleted", handleConversationDeleted);
    window.addEventListener("conversationsCleared", handleConversationsCleared);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "conversationSelected",
        handleConversationSelected
      );
      window.removeEventListener("newConversation", handleNewConversation);
      window.removeEventListener(
        "conversationDeleted",
        handleConversationDeleted
      );
      window.removeEventListener(
        "conversationsCleared",
        handleConversationsCleared
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadConversation, startNewConversation, state.currentConversationId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Reset input so the same file can be selected again
    e.target.value = "";
    // Notices describe the latest pick only
    setAttachmentNotices([]);
    void addFiles(files);
  };

  const handleScreenshotSubmit = useCallback(
    async (base64: string, prompt?: string) => {
      if (attachmentsRef.current.length + pendingReadsRef.current >= MAX_FILES) {
        setState((prev) => ({
          ...prev,
          error: `You can only upload ${MAX_FILES} files`,
        }));
        return;
      }

      try {
        if (prompt) {
          // Auto mode: Submit directly to AI with screenshot
          const attachedFile: AttachedFile = {
            id: createAttachmentId(),
            name: `screenshot_${Date.now()}.png`,
            type: "image/png",
            kind: "image",
            base64: base64,
            size: base64ByteLength(base64),
          };

          // Generate unique request ID
          const requestId = generateRequestId();
          currentRequestIdRef.current = requestId;

          // Cancel any existing request
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          abortControllerRef.current = new AbortController();
          const signal = abortControllerRef.current.signal;

          try {
            // Prepare message history for the AI
            const messageHistory = state.conversationHistory.map((msg) => ({
              role: msg.role,
              content: msg.content,
            }));

            let fullResponse = "";

            // Check if AI provider is configured
            if (!selectedAIProvider.provider) {
              setState((prev) => ({
                ...prev,
                error: "Please select an AI provider in settings",
              }));
              return;
            }

            const provider = allAiProviders.find(
              (p) => p.id === selectedAIProvider.provider
            );
            if (!provider) {
              setState((prev) => ({
                ...prev,
                error: "Invalid provider selected",
              }));
              return;
            }

            // Clear previous response and set loading state
            setState((prev) => ({
              ...prev,
              input: prompt,
              isLoading: true,
              error: null,
              response: "",
              pendingMessage: {
                id: `pending_${Date.now()}`,
                role: "user",
                content: prompt,
                timestamp: Date.now(),
              },
            }));

            // Use the fetchAIResponse function with image and signal
            for await (const chunk of fetchAIResponse({
              provider: provider,
              selectedProvider: selectedAIProvider,
              systemPrompt: systemPrompt || undefined,
              history: messageHistory,
              userMessage: prompt,
              imagesBase64: [base64],
              signal,
            })) {
              // Only update if this is still the current request
              if (currentRequestIdRef.current !== requestId || signal.aborted) {
                return; // Request was superseded or cancelled
              }

              fullResponse += chunk;
              setState((prev) => ({
                ...prev,
                response: prev.response + chunk,
              }));
            }

            // Only proceed if this is still the current request
            if (currentRequestIdRef.current !== requestId || signal.aborted) {
              return;
            }

            setState((prev) => ({ ...prev, isLoading: false }));

            // Focus input after screenshot AI response is complete
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);

            // Save the conversation after successful completion
            if (fullResponse) {
              await saveCurrentConversation(prompt, fullResponse, [
                attachedFile,
              ]);
              // Clear input after saving
              setState((prev) => ({
                ...prev,
                input: "",
              }));
            }
          } catch (e: any) {
            // Only show error if this is still the current request and not aborted
            if (currentRequestIdRef.current === requestId && !signal.aborted) {
              setState((prev) => ({
                ...prev,
                error: e.message || "An error occurred",
              }));
            }
          } finally {
            // Only update loading state if this is still the current request
            if (currentRequestIdRef.current === requestId && !signal.aborted) {
              setState((prev) => ({ ...prev, isLoading: false }));
            }
          }
        } else {
          // Manual mode: Add to attached files
          appendAttachment({
            id: createAttachmentId(),
            name: `screenshot_${Date.now()}.png`,
            type: "image/png",
            kind: "image",
            base64: base64,
            size: base64ByteLength(base64),
          });
        }
      } catch (error) {
        console.error("Failed to process screenshot:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "An error occurred processing screenshot",
          isLoading: false,
        }));
      }
    },
    [
      state.conversationHistory,
      selectedAIProvider,
      allAiProviders,
      systemPrompt,
      saveCurrentConversation,
      inputRef,
      appendAttachment,
    ]
  );

  const onRemoveAllFiles = () => {
    clearFiles();
    setIsFilesPopoverOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Allow submission if there's text OR attachments (including ones still being read)
      if (
        !state.isLoading &&
        (state.input.trim() ||
          state.attachedFiles.length > 0 ||
          pendingAttachmentReads > 0)
      ) {
        submit();
      }
    }
  };

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      // Pasted files (images, or files copied in the file manager) are
      // attached; pasted text is left to paste into the input as usual.
      const items = e.clipboardData?.items;
      if (!items) return;

      const files = Array.from(items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        e.preventDefault();
        setAttachmentNotices([]);
        await addFiles(files);
      }
    },
    [addFiles]
  );

  // A send that waited for files to finish reading goes out now, with them.
  useEffect(() => {
    if (pendingAttachmentReads === 0 && queuedSubmitRef.current) {
      const { speechText } = queuedSubmitRef.current;
      queuedSubmitRef.current = null;
      void submit(speechText);
    }
  }, [pendingAttachmentReads, submit]);

  const isPopoverOpen =
    state.isLoading ||
    state.response !== "" ||
    state.error !== null ||
    keepEngaged;

  useEffect(() => {
    resizeWindow(
      isPopoverOpen || messageHistoryOpen || isFilesPopoverOpen
    );
  }, [
    isPopoverOpen,
    messageHistoryOpen,
    resizeWindow,
    isFilesPopoverOpen,
  ]);

  // Keep the newest exchange in view in both answer and conversation modes:
  // sending scrolls to the bottom, streaming follows only while the reader is
  // at the bottom, and reading older messages is never interrupted.
  useChatAutoScroll({
    scrollAreaRef,
    isOpen: isPopoverOpen,
    isLoading: state.isLoading,
    contentKey: `${keepEngaged}:${state.response.length}:${state.conversationHistory.length}:${state.pendingMessage?.id ?? ""}`,
    conversationKey: state.currentConversationId,
    isFollowEnabled: () => getResponseSettings().autoScroll,
  });

  // Keyboard arrow key support for scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPopoverOpen) return;

      const activeScrollRef = scrollAreaRef.current || scrollAreaRef.current;
      const scrollElement = activeScrollRef?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;

      if (!scrollElement) return;

      const scrollAmount = 100; // pixels to scroll

      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollElement.scrollBy({ top: scrollAmount, behavior: "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollElement.scrollBy({ top: -scrollAmount, behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPopoverOpen, scrollAreaRef]);

  // Keyboard shortcut for toggling keep engaged mode (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleToggleShortcut = (e: KeyboardEvent) => {
      // Only trigger when popover is open
      if (!isPopoverOpen) return;

      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setKeepEngaged((prev) => !prev);
        // Focus the input after toggle (with delay to ensure DOM is ready)
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    };

    window.addEventListener("keydown", handleToggleShortcut);
    return () => window.removeEventListener("keydown", handleToggleShortcut);
  }, [isPopoverOpen]);

  const captureScreenshot = useCallback(async () => {
    if (!handleScreenshotSubmit) return;

    const config = screenshotConfigRef.current;
    screenshotInitiatedByThisContext.current = true;
    setIsScreenshotLoading(true);
    // Once the selection overlay is open, its "captured-selection" or
    // "capture-closed" event ends the capture. Every other path ends here.
    let handedOffToOverlay = false;

    try {
      // Check screen recording permission on macOS
      const platform = navigator.platform.toLowerCase();
      if (platform.includes("mac") && !hasCheckedPermissionRef.current) {
        const {
          checkScreenRecordingPermission,
          requestScreenRecordingPermission,
        } = await import("tauri-plugin-macos-permissions-api");

        const hasPermission = await checkScreenRecordingPermission();

        if (!hasPermission) {
          // Request permission
          await requestScreenRecordingPermission();

          // Wait a moment and check again
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const hasPermissionNow = await checkScreenRecordingPermission();

          if (!hasPermissionNow) {
            setState((prev) => ({
              ...prev,
              error:
                "Screen Recording permission required. Please enable it by going to System Settings > Privacy & Security > Screen & System Audio Recording. If you don't see Hey Frank in the list, click the '+' button to add it. If it's already listed, make sure it's enabled. Then restart the app.",
            }));
            return;
          }
        }
        hasCheckedPermissionRef.current = true;
      }

      if (config.enabled) {
        const base64 = await invoke("capture_to_base64");

        if (config.mode === "auto") {
          // Auto mode: Submit directly to AI with the configured prompt
          await handleScreenshotSubmit(base64 as string, config.autoPrompt);
        } else if (config.mode === "manual") {
          // Manual mode: Add to attached files without prompt
          await handleScreenshotSubmit(base64 as string);
        }
      } else {
        // Selection Mode: Open overlay to select an area
        isProcessingScreenshotRef.current = false;
        await invoke("start_screen_capture");
        handedOffToOverlay = true;
      }
    } catch (error) {
      console.error("[Screenshot] Capture failed:", error);
      setState((prev) => ({
        ...prev,
        error: config.enabled
          ? "Failed to capture screenshot. Please try again."
          : "Couldn't open screen selection. Please try again.",
      }));
      isProcessingScreenshotRef.current = false;
      if (!config.enabled) {
        // A failed start can leave some overlays open; close any that are.
        invoke("close_overlay_window").catch((closeError) => {
          console.error("[Screenshot] Failed to close selection overlay:", closeError);
        });
      }
    } finally {
      if (!handedOffToOverlay) {
        setIsScreenshotLoading(false);
        screenshotInitiatedByThisContext.current = false;
      }
    }
  }, [handleScreenshotSubmit]);

  useEffect(() => {
    // listen() resolves asynchronously: if this effect is cleaned up first,
    // unsubscribe as soon as it resolves instead of leaking a stale listener.
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const unsubscribe = await listen("captured-selection", async (event: any) => {
        if (!screenshotInitiatedByThisContext.current) {
          return;
        }

        if (isProcessingScreenshotRef.current) {
          return;
        }

        isProcessingScreenshotRef.current = true;
        const base64 = event.payload;
        const config = screenshotConfigRef.current;

        try {
          if (config.mode === "auto") {
            // Auto mode: Submit directly to AI with the configured prompt
            await handleScreenshotSubmit(base64 as string, config.autoPrompt);
          } else if (config.mode === "manual") {
            // Manual mode: Add to attached files without prompt
            await handleScreenshotSubmit(base64 as string);
          }
        } catch (error) {
          console.error("Error processing selection:", error);
        } finally {
          setIsScreenshotLoading(false);
          screenshotInitiatedByThisContext.current = false;
          setTimeout(() => {
            isProcessingScreenshotRef.current = false;
          }, 100);
        }
      });
      if (disposed) unsubscribe();
      else unlisten = unsubscribe;
    };

    setupListener().catch((error) => {
      console.error("[Screenshot] Failed to listen for captured selections:", error);
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleScreenshotSubmit]);

  useEffect(() => {
    const unlisten = listen("capture-closed", () => {
      setIsScreenshotLoading(false);
      isProcessingScreenshotRef.current = false;
      screenshotInitiatedByThisContext.current = false;
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      currentRequestIdRef.current = null;
    };
  }, []);

  // register callbacks for global shortcuts
  useEffect(() => {
    globalShortcuts.registerAudioCallback(invokeVoiceShortcutToggle);
    globalShortcuts.registerInputRef(inputRef.current);
    globalShortcuts.registerScreenshotCallback(captureScreenshot);
  }, [
    globalShortcuts.registerAudioCallback,
    globalShortcuts.registerInputRef,
    globalShortcuts.registerScreenshotCallback,
    captureScreenshot,
    inputRef,
  ]);

  return {
    input: state.input,
    setInput,
    response: state.response,
    setResponse,
    isLoading: state.isLoading,
    error: state.error,
    attachedFiles: state.attachedFiles,
    addFile,
    removeFile,
    clearFiles,
    submit,
    cancel,
    reset,
    setState,
    currentConversationId: state.currentConversationId,
    conversationHistory: state.conversationHistory,
    pendingMessage: state.pendingMessage,
    loadConversation,
    startNewConversation,
    messageHistoryOpen,
    setMessageHistoryOpen,
    screenshotConfiguration,
    setScreenshotConfiguration,
    handleScreenshotSubmit,
    handleFileSelect,
    handleKeyPress,
    handlePaste,
    isPopoverOpen,
    scrollAreaRef,
    resizeWindow,
    isFilesPopoverOpen,
    setIsFilesPopoverOpen,
    onRemoveAllFiles,
    attachmentNotices,
    dismissAttachmentNotices,
    isReadingAttachments: pendingAttachmentReads > 0,
    inputRef,
    captureScreenshot,
    isScreenshotLoading,
    keepEngaged,
    setKeepEngaged,
  };
};
