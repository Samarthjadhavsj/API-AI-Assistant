import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveConversation, fetchAIResponse } from "@/lib";
import { AIRequestError } from "@/lib/functions/ai-response.function";
import type { ChatConversation } from "@/types/completion";
import { useCompletion } from "./useCompletion";

const app = vi.hoisted(() => ({
  provider: "claude",
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@/contexts", async () => {
  const { AI_PROVIDERS } = await vi.importActual<typeof import("@/config/ai-providers.constants")>(
    "@/config/ai-providers.constants"
  );
  return {
    useApp: () => ({
      selectedAIProvider: { provider: app.provider, variables: { api_key: "k", model: "m" } },
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

const fetchMock = vi.mocked(fetchAIResponse);
const saveMock = vi.mocked(saveConversation);

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0];

let fileCounter = 0;
/** A distinct image each call (unique content), unless bytes are given. */
const png = (name: string, bytes: number[] = [...PNG, fileCounter++ % 256, fileCounter]) =>
  new File([new Uint8Array(bytes)], name, { type: "image/png" });
const textFile = (name: string, text: string) => new File([text], name, { type: "text/plain" });

type Hook = { current: ReturnType<typeof useCompletion> };

const setup = async () => {
  const hook = renderHook(() => useCompletion());
  await act(async () => {});
  return hook;
};

/** Picks files as the hidden file input would. */
const pick = (result: Hook, files: File[]) =>
  act(async () => {
    result.current.handleFileSelect({ target: { files, value: "C:\\fakepath" } } as any);
  });

const attachedNames = (result: Hook) => result.current.attachedFiles.map((f) => f.name);

const waitForAttached = (result: Hook, count: number) =>
  waitFor(() => {
    expect(result.current.attachedFiles).toHaveLength(count);
    expect(result.current.isReadingAttachments).toBe(false);
  });

const send = (result: Hook, speechText?: string) =>
  act(async () => {
    await result.current.submit(speechText);
  });

/** fetchAIResponse yielding an answer. */
const answers = (...chunks: string[]) =>
  fetchMock.mockImplementation(async function* () {
    for (const chunk of chunks) yield chunk;
  });

const lastRequest = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];

describe("useCompletion attachments", () => {
  beforeEach(() => {
    app.provider = "claude";
    fetchMock.mockReset();
    saveMock.mockClear();
    answers("An answer");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("attaching", () => {
    it("gives files picked together unique ids, so removing one removes only it", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const { result } = await setup();

      await pick(result, [png("a.png"), png("b.png"), png("c.png")]);
      await waitForAttached(result, 3);

      const ids = result.current.attachedFiles.map((f) => f.id);
      expect(new Set(ids).size).toBe(3);

      act(() => result.current.removeFile(ids[1]));
      expect(attachedNames(result)).toEqual(["a.png", "c.png"]);
    });

    it("says which files were left out at the limit instead of dropping them silently", async () => {
      const { result } = await setup();
      const files = Array.from({ length: 8 }, (_, i) => png(`img${i}.png`));

      await pick(result, files);
      await waitForAttached(result, 6);

      expect(result.current.attachmentNotices).toEqual([
        'You can attach up to 6 files. 2 files weren\'t added: "img6.png", "img7.png".',
      ]);
      expect(result.current.isFilesPopoverOpen).toBe(true);
    });

    it("never goes over the limit when files are picked again before the first ones are read", async () => {
      const { result } = await setup();

      await act(async () => {
        result.current.handleFileSelect({ target: { files: [1, 2, 3, 4].map((i) => png(`a${i}.png`)), value: "" } } as any);
        result.current.handleFileSelect({ target: { files: [1, 2, 3, 4].map((i) => png(`b${i}.png`)), value: "" } } as any);
      });
      await waitForAttached(result, 6);

      expect(attachedNames(result)).toEqual(["a1.png", "a2.png", "a3.png", "a4.png", "b1.png", "b2.png"]);
      expect(result.current.attachmentNotices[0]).toMatch(/"b3\.png", "b4\.png"/);
    });

    it("doesn't attach the same file twice", async () => {
      const { result } = await setup();
      const bytes = [...PNG, 7, 7, 7];

      await pick(result, [png("photo.png", bytes)]);
      await waitForAttached(result, 1);
      await pick(result, [png("photo.png", bytes), png("copy-of-photo.png", bytes)]);
      await waitFor(() => expect(result.current.attachmentNotices).toHaveLength(2));

      expect(attachedNames(result)).toEqual(["photo.png"]);
      expect(result.current.attachmentNotices).toEqual([
        '"photo.png" is already attached.',
        '"copy-of-photo.png" is already attached.',
      ]);
    });

    it("keeps same-named files with different content (picked from different folders)", async () => {
      const { result } = await setup();

      await pick(result, [textFile("index.ts", "export const a = 1;"), textFile("index.ts", "export const b = 2;")]);
      await waitForAttached(result, 2);

      expect(attachedNames(result)).toEqual(["index.ts", "index.ts"]);
    });

    it("attaches the supported files and explains the rest, keeping the answer and draft", async () => {
      const { result } = await setup();
      act(() => {
        result.current.setState((prev: any) => ({ ...prev, input: "my draft", response: "Visible answer" }));
      });

      await pick(result, [
        png("ok.png"),
        new File(["%PDF-1.7"], "report.pdf", { type: "application/pdf" }),
        new File([], "empty.txt", { type: "text/plain" }),
        textFile("notes.md", "# Notes"),
      ]);
      await waitForAttached(result, 2);
      await waitFor(() => expect(result.current.attachmentNotices).toHaveLength(2));

      expect(attachedNames(result)).toEqual(["ok.png", "notes.md"]);
      expect(result.current.attachmentNotices).toEqual([
        expect.stringMatching(/^report\.pdf: PDFs aren't supported/),
        "empty.txt: the file is empty.",
      ]);
      // Notices live in the attachments panel, not the answer panel
      expect(result.current.error).toBeNull();
      expect(result.current.response).toBe("Visible answer");
      expect(result.current.input).toBe("my draft");
    });

    it("a new pick clears the previous notices", async () => {
      const { result } = await setup();
      await pick(result, [new File([], "empty.png", { type: "image/png" })]);
      await waitFor(() => expect(result.current.attachmentNotices).toHaveLength(1));

      await pick(result, [png("fine.png")]);
      await waitForAttached(result, 1);

      expect(result.current.attachmentNotices).toEqual([]);
    });

    it("attaches pasted files, and leaves plain text pastes alone", async () => {
      const { result } = await setup();
      const preventDefault = vi.fn();
      const pasted = png("image.png");

      await act(async () => {
        await result.current.handlePaste({
          preventDefault,
          clipboardData: {
            items: [
              { kind: "string", type: "text/html", getAsFile: () => null },
              { kind: "file", type: "image/png", getAsFile: () => pasted },
            ],
          },
        } as any);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(attachedNames(result)).toEqual(["image.png"]);

      const textPaste = vi.fn();
      await act(async () => {
        await result.current.handlePaste({
          preventDefault: textPaste,
          clipboardData: { items: [{ kind: "string", type: "text/plain", getAsFile: () => null }] },
        } as any);
      });
      expect(textPaste).not.toHaveBeenCalled();
    });
  });

  describe("sending", () => {
    it("sends images with their real type, and text files inside the message", async () => {
      const { result } = await setup();
      act(() => result.current.setInput("What's wrong here?"));
      await pick(result, [
        new File([new Uint8Array([...JPEG, 1])], "photo.jpg", { type: "image/jpeg" }),
        textFile("bug.py", "print(1/0)\n"),
      ]);
      await waitForAttached(result, 2);

      await send(result);

      const request = lastRequest();
      expect(request.images).toEqual([{ data: btoa(String.fromCharCode(...JPEG, 1)), mimeType: "image/jpeg" }]);
      expect(request.userMessage).toBe("Attached file: bug.py\n```py\nprint(1/0)\n```\n\nWhat's wrong here?");
    });

    it("saves what was attached with the message, but not the image data", async () => {
      const { result } = await setup();
      act(() => result.current.setInput("Review"));
      await pick(result, [png("screen.png"), textFile("a.ts", "let x = 1;")]);
      await waitForAttached(result, 2);

      await send(result);

      const saved = saveMock.mock.calls[0][0] as ChatConversation;
      const userMessage = saved.messages[0];
      expect(userMessage.content).toBe("Review");
      expect(userMessage.attachedFiles).toEqual([
        expect.objectContaining({ name: "screen.png", kind: "image", base64: "" }),
        expect.objectContaining({ name: "a.ts", kind: "text", base64: "", text: "let x = 1;" }),
      ]);
      // Sent files are cleared after a successful answer
      expect(result.current.attachedFiles).toEqual([]);
      expect(result.current.input).toBe("");
      expect(result.current.conversationHistory[0].attachedFiles).toHaveLength(2);
    });

    it("shows the attachments on the question while it's being answered", async () => {
      let finish!: () => void;
      fetchMock.mockImplementation(async function* () {
        await new Promise<void>((resolve) => (finish = resolve));
        yield "done";
      });
      const { result } = await setup();
      await pick(result, [png("chart.png")]);
      await waitForAttached(result, 1);

      act(() => {
        void result.current.submit();
      });
      await waitFor(() => expect(result.current.isLoading).toBe(true));

      expect(result.current.pendingMessage).toMatchObject({
        content: "What's in this image?",
        attachedFiles: [expect.objectContaining({ name: "chart.png" })],
      });
      await act(async () => finish());
    });

    it("waits for files still being read, then sends them with the message", async () => {
      const { result } = await setup();
      act(() => result.current.setInput("Look at this"));

      await act(async () => {
        result.current.handleFileSelect({ target: { files: [png("late.png")], value: "" } } as any);
        void result.current.submit();
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(lastRequest().images).toHaveLength(1);
      expect(lastRequest().userMessage).toBe("Look at this");
      await waitFor(() => expect(result.current.attachedFiles).toEqual([]));
    });

    it("sends a voice transcript together with the attachments", async () => {
      const { result } = await setup();
      await pick(result, [png("diagram.png")]);
      await waitForAttached(result, 1);

      await send(result, "explain this diagram");

      expect(lastRequest().userMessage).toBe("explain this diagram");
      expect(lastRequest().images).toHaveLength(1);
    });

    it("includes text files from earlier in the conversation when continuing it", async () => {
      const { result } = await setup();
      act(() => {
        result.current.loadConversation({
          id: "conv_9",
          title: "Earlier",
          createdAt: 1,
          updatedAt: 2,
          messages: [
            {
              id: "u1",
              role: "user",
              content: "Review",
              timestamp: 1,
              attachedFiles: [{ id: "f", name: "a.ts", type: "text/plain", kind: "text", base64: "", size: 5, text: "x = 1" }],
            },
            { id: "a1", role: "assistant", content: "Looks fine", timestamp: 2 },
          ],
        });
      });
      act(() => result.current.setInput("And now?"));

      await send(result);

      expect(lastRequest().history).toEqual([
        { role: "user", content: "Attached file: a.ts\n```ts\nx = 1\n```\n\nReview" },
        { role: "assistant", content: "Looks fine" },
      ]);
    });
  });

  describe("failures and retry", () => {
    it("keeps the attachments and draft when the provider rejects the request, and doesn't save it", async () => {
      fetchMock.mockImplementation(async function* () {
        throw new AIRequestError("API request failed: 400 Bad Request - image too large", 400);
      });
      const { result } = await setup();
      act(() => result.current.setInput("Describe"));
      await pick(result, [png("a.png")]);
      await waitForAttached(result, 1);

      await send(result);

      expect(result.current.error).toBe("API request failed: 400 Bad Request - image too large");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.response).toBe("");
      expect(attachedNames(result)).toEqual(["a.png"]);
      expect(result.current.input).toBe("Describe");
      expect(saveMock).not.toHaveBeenCalled();

      // Retry succeeds with the same attachment
      answers("Now it works");
      await send(result);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(lastRequest().images).toHaveLength(1);
      expect(result.current.response).toBe("Now it works");
      expect(result.current.error).toBeNull();
      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(result.current.attachedFiles).toEqual([]);
    });

    it("keeps the partial answer visible but unsaved when the stream breaks", async () => {
      fetchMock.mockImplementation(async function* () {
        yield "Half an ";
        throw new AIRequestError("Error reading stream: connection reset");
      });
      const { result } = await setup();
      await pick(result, [textFile("a.txt", "hello")]);
      await waitForAttached(result, 1);

      await send(result);

      expect(result.current.response).toBe("Half an ");
      expect(result.current.error).toBe("Error reading stream: connection reset");
      expect(attachedNames(result)).toEqual(["a.txt"]);
      expect(saveMock).not.toHaveBeenCalled();
    });

    it("explains before sending when the provider can't take images", async () => {
      app.provider = "groq";
      const { result } = await setup();
      act(() => result.current.setInput("What is this?"));
      await pick(result, [png("cat.png")]);
      await waitForAttached(result, 1);

      await send(result);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.error).toBe(
        'Groq can\'t read images. Remove "cat.png" or switch to a provider that supports images.'
      );
      expect(result.current.isLoading).toBe(false);
      expect(attachedNames(result)).toEqual(["cat.png"]);
      expect(result.current.input).toBe("What is this?");
    });

    it("sends text files to a provider without image support", async () => {
      app.provider = "groq";
      const { result } = await setup();
      await pick(result, [textFile("data.csv", "a,b\n1,2")]);
      await waitForAttached(result, 1);

      await send(result);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(lastRequest().userMessage).toBe(
        "Attached file: data.csv\n```csv\na,b\n1,2\n```\n\nPlease review the attached file."
      );
    });

    it("explains a format the provider doesn't accept (GIF with Gemini)", async () => {
      app.provider = "gemini";
      const { result } = await setup();
      await pick(result, [new File([new Uint8Array(GIF)], "anim.gif", { type: "image/gif" })]);
      await waitForAttached(result, 1);

      await send(result);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.error).toMatch(/Gemini doesn't accept "anim\.gif"/);
    });
  });

  describe("stale attachment state", () => {
    it("keeps a screenshot added while the answer was streaming", async () => {
      let finish!: () => void;
      fetchMock.mockImplementation(async function* () {
        await new Promise<void>((resolve) => (finish = resolve));
        yield "answer";
      });
      const { result } = await setup();
      await pick(result, [png("sent.png")]);
      await waitForAttached(result, 1);

      let sending!: Promise<void>;
      act(() => {
        sending = result.current.submit();
      });
      await waitFor(() => expect(result.current.isLoading).toBe(true));
      await act(async () => {
        await result.current.handleScreenshotSubmit("U0NSRUVO");
      });
      await act(async () => {
        finish();
        await sending;
      });

      expect(result.current.attachedFiles.map((f) => f.base64)).toEqual(["U0NSRUVO"]);
    });

    it("New Chat drops files still being read", async () => {
      const { result } = await setup();
      await act(async () => {
        result.current.handleFileSelect({ target: { files: [png("slow.png")], value: "" } } as any);
        result.current.startNewConversation();
      });
      await waitFor(() => expect(result.current.isReadingAttachments).toBe(false));

      expect(result.current.attachedFiles).toEqual([]);
    });

    it("New Chat drops a send that was waiting for files", async () => {
      const { result } = await setup();
      await act(async () => {
        result.current.handleFileSelect({ target: { files: [png("slow.png")], value: "" } } as any);
        void result.current.submit();
        result.current.startNewConversation();
      });
      await waitFor(() => expect(result.current.isReadingAttachments).toBe(false));

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("opening a conversation from history keeps the attachments for the next message", async () => {
      const { result } = await setup();
      await pick(result, [png("keep.png")]);
      await waitForAttached(result, 1);

      act(() => {
        result.current.loadConversation({ id: "c2", title: "t", createdAt: 1, updatedAt: 1, messages: [] });
      });

      expect(attachedNames(result)).toEqual(["keep.png"]);
    });

    it("Remove All clears attachments and notices", async () => {
      const { result } = await setup();
      await pick(result, [png("a.png"), new File([], "b.png", { type: "image/png" })]);
      await waitFor(() => expect(result.current.attachmentNotices).toHaveLength(1));

      act(() => result.current.onRemoveAllFiles());

      expect(result.current.attachedFiles).toEqual([]);
      expect(result.current.attachmentNotices).toEqual([]);
      expect(result.current.isFilesPopoverOpen).toBe(false);
    });
  });
});
