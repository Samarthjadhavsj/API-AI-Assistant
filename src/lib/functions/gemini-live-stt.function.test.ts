import { afterEach, describe, expect, it, vi } from "vitest";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

import {
  extractGeminiTranscribeText,
  fetchGeminiLiveSTT,
  formatGeminiLiveError,
  geminiAudioMimeType,
  normalizeGeminiApiKey,
  normalizeGeminiLiveModel,
  normalizeGeminiTranscribeModel,
} from "./gemini-live-stt.function";

const uploadedFile = {
  name: "files/voice",
  uri: "https://generativelanguage.googleapis.com/v1beta/files/voice",
  mime_type: "audio/webm",
  state: "ACTIVE",
};

async function expectUploadCleanup() {
  await vi.waitFor(() => expect(tauriFetch).toHaveBeenCalledTimes(4));
  const [deleteUrl, deleteRequest] = vi.mocked(tauriFetch).mock.calls[3] || [];
  expect(String(deleteUrl)).toBe("https://generativelanguage.googleapis.com/v1beta/files/voice");
  expect(deleteRequest).toEqual(
    expect.objectContaining({
      method: "DELETE",
      headers: { "x-goog-api-key": "AIzaExample" },
    })
  );
}

describe("Gemini transcription configuration", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a bare key and common environment-variable paste format", () => {
    expect(normalizeGeminiApiKey("  AIzaExample  ")).toBe("AIzaExample");
    expect(normalizeGeminiApiKey('GEMINI_API_KEY="AIzaExample"')).toBe(
      "AIzaExample"
    );
  });

  it("extracts a key copied from a Live WebSocket URL", () => {
    expect(
      normalizeGeminiApiKey(
        "wss://generativelanguage.googleapis.com/ws/service?key=AIzaExample&unused=value"
      )
    ).toBe("AIzaExample");
  });

  it("normalizes pasted Live model names", () => {
    expect(normalizeGeminiLiveModel("gemini-3.5-transcribe-live")).toBe(
      "models/gemini-3.5-transcribe-live"
    );
    expect(normalizeGeminiLiveModel("models/gemini-3.5-transcribe-live")).toBe(
      "models/gemini-3.5-transcribe-live"
    );
  });

  it("maps live models onto the batch transcribe model used after recording", () => {
    expect(normalizeGeminiTranscribeModel("gemini-3.5-transcribe-live")).toBe(
      "gemini-3.5-transcribe"
    );
    expect(normalizeGeminiTranscribeModel("models/gemini-3.5-transcribe")).toBe(
      "gemini-3.5-transcribe"
    );
  });

  it("explains an invalid Gemini API key error", () => {
    expect(
      formatGeminiLiveError("API key not valid. Please pass a valid API key.").message
    ).toContain("Gemini rejected this API key");
  });

  it("strips codec parameters from recorded audio MIME types", () => {
    expect(geminiAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
  });

  it("reads Interactions and generateContent transcription payloads", () => {
    expect(extractGeminiTranscribeText({ output_text: "hello" })).toBe("hello");
    expect(
      extractGeminiTranscribeText({
        candidates: [{ content: { parts: [{ text: "from generateContent" }] } }],
      })
    ).toBe("from generateContent");
    expect(
      extractGeminiTranscribeText({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: "from steps" }],
          },
        ],
      })
    ).toBe("from steps");
  });

  it("uploads recordings before transcribing them through the Interactions API", async () => {
    vi.mocked(tauriFetch)
      .mockResolvedValueOnce(
        new Response("", {
          status: 200,
          headers: { "x-goog-upload-url": "https://upload.example.test/voice" },
        }) as any
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            file: uploadedFile,
          }),
          { status: 200 }
        ) as any
      )
      .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "completed",
          steps: [{ type: "model_output", content: [{ type: "text", text: "hello from gemini" }] }],
        }),
        { status: 200 }
      ) as any
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }) as any
      );

    await expect(
      fetchGeminiLiveSTT(
        new Blob(["clip"], { type: "audio/webm;codecs=opus" }),
        "AIzaExample",
        "wss://generativelanguage.googleapis.com/ws/service",
        undefined,
        "gemini-3.5-transcribe-live"
      )
    ).resolves.toBe("hello from gemini");

    const [startUrl, startRequest] = vi.mocked(tauriFetch).mock.calls[0] || [];
    expect(String(startUrl)).toContain("https://generativelanguage.googleapis.com/upload/v1beta/files");
    expect(startRequest).toEqual(expect.objectContaining({ method: "POST" }));
    expect(
      (startRequest as { headers?: Record<string, string> }).headers?.["X-Goog-Upload-Command"]
    ).toBe("start");

    const [url, request] = vi.mocked(tauriFetch).mock.calls[2] || [];
    expect(String(url)).toContain("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(String(url)).not.toContain("key=");
    expect(request).toEqual(expect.objectContaining({ method: "POST" }));
    expect((request as { headers?: Record<string, string> }).headers?.["x-goog-api-key"]).toBe(
      "AIzaExample"
    );
    const body = JSON.parse((request as { body?: string })?.body as string);
    expect(body.model).toBe("gemini-3.5-transcribe");
    expect(body.input[0].mime_type).toBe("audio/webm");
    expect(body.input[0].uri).toContain("files/voice");
    expect(body.input[0].data).toBeUndefined();
    expect(body.generation_config).toEqual({ transcription_config: { mode: "smart" } });
    await expectUploadCleanup();
  });

  it("deletes the uploaded file after an interaction failure", async () => {
    vi.mocked(tauriFetch)
      .mockResolvedValueOnce(
        new Response("", {
          status: 200,
          headers: { "x-goog-upload-url": "https://upload.example.test/voice" },
        }) as any
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ file: uploadedFile }), { status: 200 }) as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "interaction failed" } }), { status: 500 }) as any
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }) as any);

    await expect(
      fetchGeminiLiveSTT(new Blob(["clip"], { type: "audio/webm" }), "AIzaExample")
    ).rejects.toThrow("interaction failed");

    await expectUploadCleanup();
  });

  it("deletes the uploaded file when transcription is cancelled", async () => {
    const controller = new AbortController();
    vi.mocked(tauriFetch)
      .mockResolvedValueOnce(
        new Response("", {
          status: 200,
          headers: { "x-goog-upload-url": "https://upload.example.test/voice" },
        }) as any
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ file: { ...uploadedFile, state: "PROCESSING" } }),
          { status: 200 }
        ) as any
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }) as any);

    const request = fetchGeminiLiveSTT(
      new Blob(["clip"], { type: "audio/webm" }),
      "AIzaExample",
      undefined,
      controller.signal
    );
    await vi.waitFor(() => expect(tauriFetch).toHaveBeenCalledTimes(2));
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    await expectUploadCleanup();
  });
});
