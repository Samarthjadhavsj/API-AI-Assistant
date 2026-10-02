import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAIResponse, getConversationById } from "@/lib";
import type { ChatConversation } from "@/types/completion";
import { useCompletion } from "./useCompletion";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@/contexts", async () => {
  const { AI_PROVIDERS } = await vi.importActual<typeof import("@/config/ai-providers.constants")>(
    "@/config/ai-providers.constants"
  );
  return {
    useApp: () => ({
      selectedAIProvider: { provider: "claude", variables: { api_key: "k", model: "m" } },
      allAiProviders: AI_PROVIDERS,
      systemPrompt: "",
      screenshotConfiguration: { mode: "manual", autoPrompt: "", enabled: true },
      setScreenshotConfiguration: vi.fn(),
    }),
  };
});
vi.mock("@/hooks", () => ({
  useGlobalShortcuts: () => ({
    registerAudioCallback: vi.fn(),
    registerInputRef: vi.fn(),
    registerScreenshotCallback: vi.fn(),
  }),
}));
vi.mock("@/hooks/useVoiceInput", () => ({ invokeVoiceShortcutToggle: vi.fn() }));
vi.mock("./useWindow", () => ({ useWindowResize: () => ({ resizeWindow: vi.fn() }) }));
vi.mock("@/lib", () => ({
  fetchAIResponse: vi.fn(),
  saveConversation: vi.fn(async (c: unknown) => c),
  getConversationById: vi.fn(async () => null),
  generateConversationTitle: vi.fn((m: string) => m),
  MESSAGE_ID_OFFSET: 1,
  generateConversationId: vi.fn(() => "conv_1"),
  generateMessageId: vi.fn((role: string, t: number) => `${role}_${t}`),
  generateRequestId: vi.fn(() => `req_${Math.random()}`),
  getResponseSettings: vi.fn(() => ({ autoScroll: true })),
}));

const conversation = (id: string, answer: string): ChatConversation => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 2,
  messages: [
    { id: `${id}_q`, role: "user", content: "Question", timestamp: 1 },
    { id: `${id}_a`, role: "assistant", content: answer, timestamp: 2 },
  ],
});

const loadConversation = async (result: { current: ReturnType<typeof useCompletion> }, c: ChatConversation) => {
  vi.mocked(getConversationById).mockResolvedValueOnce(c);
  act(() => {
    window.dispatchEvent(new CustomEvent("conversationSelected", { detail: { id: c.id } }));
  });
  await waitFor(() => expect(result.current.currentConversationId).toBe(c.id));
};

describe("useCompletion: answer panel hidden by the Message History icon", () => {
  beforeEach(() => {
    vi.mocked(fetchAIResponse).mockImplementation(async function* () {
      yield "Fresh answer";
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("hides the panel without clearing the answer, draft or conversation", async () => {
    const { result } = renderHook(() => useCompletion());
    await loadConversation(result, conversation("conv_a", "First answer"));
    act(() => result.current.setInput("my draft"));
    expect(result.current.isPopoverOpen).toBe(true);

    act(() => result.current.setIsAnswerPanelHidden(true));

    expect(result.current.isPopoverOpen).toBe(false);
    expect(result.current.response).toBe("First answer");
    expect(result.current.input).toBe("my draft");
    expect(result.current.currentConversationId).toBe("conv_a");
    expect(result.current.conversationHistory).toHaveLength(2);
  });

  it("sending a question shows the panel again", async () => {
    const { result } = renderHook(() => useCompletion());
    await loadConversation(result, conversation("conv_a", "First answer"));
    act(() => result.current.setIsAnswerPanelHidden(true));
    act(() => result.current.setInput("Next question"));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.isPopoverOpen).toBe(true);
    expect(result.current.response).toBe("Fresh answer");
  });

  it("switching to another conversation shows the panel again", async () => {
    const { result } = renderHook(() => useCompletion());
    await loadConversation(result, conversation("conv_a", "First answer"));
    act(() => result.current.setIsAnswerPanelHidden(true));
    expect(result.current.isPopoverOpen).toBe(false);

    await loadConversation(result, conversation("conv_b", "Other answer"));

    expect(result.current.isPopoverOpen).toBe(true);
    expect(result.current.response).toBe("Other answer");
  });
});
