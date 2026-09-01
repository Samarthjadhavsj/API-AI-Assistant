import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const FILES_UPLOAD_URL =
  "https://generativelanguage.googleapis.com/upload/v1beta/files";
const FILES_URL = "https://generativelanguage.googleapis.com/v1beta/files";
const BATCH_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
const LIVE_TRANSCRIBE_MODEL = "gemini-3.5-transcribe-live";
const FILE_POLL_TIMEOUT_MS = 120_000;
const INTERACTION_POLL_TIMEOUT_MS = 120_000;
const INITIAL_POLL_DELAY_MS = 500;
const MAX_POLL_DELAY_MS = 10_000;

export type GeminiSttFailureCode = "upload_failed" | "polling_timeout" | "stt_request_failed";

export class GeminiSttError extends Error {
  constructor(readonly code: GeminiSttFailureCode, message: string) {
    super(message);
    this.name = "GeminiSttError";
  }
}

/**
 * Accept the common forms copied from AI Studio, .env files, and WebSocket
 * examples, but always send Gemini just the key value.
 */
export function normalizeGeminiApiKey(value: string): string {
  let key = value.trim();
  if (!key) return "";

  try {
    const copiedUrl = new URL(key);
    const keyFromUrl = copiedUrl.searchParams.get("key");
    if (keyFromUrl) return keyFromUrl.trim();
  } catch {
    // The normal case is a bare API key, which is not a URL.
  }

  key = key
    .replace(/^(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|API_KEY|key)\s*=\s*/i, "")
    .trim()
    .replace(/^(?:["'`])|(?:["'`])$/g, "")
    .trim();

  if (key.startsWith("?")) {
    return new URLSearchParams(key.slice(1)).get("key")?.trim() || key;
  }

  return key;
}

export function normalizeGeminiLiveModel(model?: string): string {
  const id =
    (model || BATCH_TRANSCRIBE_MODEL).trim().replace(/^models\//, "") ||
    BATCH_TRANSCRIBE_MODEL;
  return `models/${id}`;
}

/** Cursor-style mic records a clip, then transcribes it. Live models are mapped to batch. */
export function normalizeGeminiTranscribeModel(model?: string): string {
  const id = (model || BATCH_TRANSCRIBE_MODEL).trim().replace(/^models\//, "");
  if (!id || id === LIVE_TRANSCRIBE_MODEL) return BATCH_TRANSCRIBE_MODEL;
  return id;
}

export function formatGeminiLiveError(message: string): Error {
  if (/api[ _-]?key(?:_INVALID)?[^\n]*?(?:not valid|invalid)|API_KEY_INVALID/i.test(message)) {
    return new Error(
      "Gemini rejected this API key. Paste the key value only (not `GEMINI_API_KEY=…` or a URL). " +
        "If it still fails, create a new Gemini API Auth key in Google AI Studio and restrict it to the Gemini API."
    );
  }

  return new Error(message || "Gemini transcription failed.");
}

export function geminiAudioMimeType(type?: string): string {
  const mime = (type || "audio/webm").split(";")[0].trim().toLowerCase();
  if (mime.startsWith("audio/")) return mime;
  return "audio/webm";
}

function pushTranscript(target: string[], value: unknown) {
  if (typeof value === "string" && value.trim()) target.push(value.trim());
}

function walkTranscriptContent(target: string[], node: unknown) {
  if (!node) return;
  if (typeof node === "string") {
    pushTranscript(target, node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkTranscriptContent(target, item);
    return;
  }
  if (typeof node !== "object") return;

  const item = node as Record<string, any>;
  pushTranscript(target, item.output_text);
  pushTranscript(target, item.outputText);
  pushTranscript(target, item.text);
  pushTranscript(target, item.transcript);
  pushTranscript(target, item.transcription);
  pushTranscript(target, item.inputTranscription?.text);
  if (item.content) walkTranscriptContent(target, item.content);
  if (item.parts) walkTranscriptContent(target, item.parts);
  if (item.steps) walkTranscriptContent(target, item.steps);
}

/** REST Interactions responses put text in steps, not the SDK-only output_text field. */
export function extractGeminiTranscribeText(payload: Record<string, any> | null | undefined): string {
  if (!payload) return "";

  const collected: string[] = [];
  const direct = payload.output_text || payload.outputText;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  walkTranscriptContent(collected, payload.outputs);
  walkTranscriptContent(collected, payload.output);
  walkTranscriptContent(collected, payload.steps);

  const candidates = payload.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      walkTranscriptContent(collected, candidate?.content?.parts);
    }
  }

  return collected.join(" ").trim();
}

function isPendingInteraction(payload: Record<string, any>): boolean {
  const status = String(payload.status || "").toLowerCase();
  return status === "incomplete" || status === "in_progress" || status === "queued";
}

function httpClientFor(url: string) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return fetch;
  } catch {
    // Use Tauri's HTTP client for public APIs so CORS does not block the overlay.
  }
  return tauriFetch;
}

function geminiFailure(code: GeminiSttFailureCode, message: string): GeminiSttError {
  return new GeminiSttError(code, formatGeminiLiveError(message).message);
}

/** Logs only response shape in development; never key, URL, audio, or transcript. */
function logGeminiSttDiagnostics(httpStatus: number, payload: Record<string, any> | null) {
  if (!import.meta.env.DEV) return;
  const outputText = payload?.output_text;
  const steps = Array.isArray(payload?.steps) ? payload.steps : undefined;
  console.debug("[gemini-stt] response", {
    httpStatus,
    topLevelKeys: payload ? Object.keys(payload) : [],
    status: typeof payload?.status === "string" ? payload.status : undefined,
    hasOutputText: typeof outputText === "string",
    outputTextLength: typeof outputText === "string" ? outputText.length : 0,
    hasErrors: Array.isArray(payload?.errors) && payload.errors.length > 0,
    steps: steps
      ? { count: steps.length, types: steps.map((step) => step?.type).filter(Boolean) }
      : undefined,
  });
}

async function requestGeminiJson(
  url: string,
  apiKey: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown },
  signal?: AbortSignal
): Promise<Record<string, any>> {
  const response = await httpClientFor(url)(url, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal,
  });
  const raw = await response.text();
  let parsed: Record<string, any> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  logGeminiSttDiagnostics(response.status, parsed);
  if (!response.ok) {
    throw geminiFailure(
      "stt_request_failed",
      parsed?.error?.message || raw || response.statusText || "Gemini transcription failed."
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini returned an empty transcription response.");
  }
  if (parsed.error?.message) {
    throw geminiFailure("stt_request_failed", parsed.error.message);
  }
  return parsed;
}

async function responseError(
  response: Response,
  fallback: string,
  code: GeminiSttFailureCode
): Promise<GeminiSttError> {
  let raw = "";
  try {
    raw = await response.text();
  } catch {
    // Use the fallback message when the response body cannot be read.
  }

  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return geminiFailure(code, parsed?.error?.message || raw || fallback);
  } catch {
    return geminiFailure(code, raw || fallback);
  }
}

type GeminiFile = {
  name?: string;
  uri?: string;
  mime_type?: string;
  mimeType?: string;
  state?: string;
  error?: { message?: string };
};

/** Upload a finalized local recording using Gemini's resumable Files API. */
async function uploadGeminiAudio(
  audio: Blob,
  mimeType: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<GeminiFile> {
  const startResponse = await httpClientFor(FILES_UPLOAD_URL)(FILES_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(audio.size),
      "X-Goog-Upload-Header-Content-Type": mimeType,
    },
    body: JSON.stringify({ file: { display_name: "voice-input" } }),
    signal,
  });

  if (!startResponse.ok) {
    throw await responseError(startResponse, "Gemini could not start the audio upload.", "upload_failed");
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Gemini did not return an upload URL for the recording.");
  }

  const uploadResponse = await httpClientFor(uploadUrl)(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(audio.size),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: audio,
    signal,
  });

  if (!uploadResponse.ok) {
    throw await responseError(uploadResponse, "Gemini could not upload the recording.", "upload_failed");
  }

  const payload = (await uploadResponse.json()) as { file?: GeminiFile } | GeminiFile;
  const file: GeminiFile = (
    "file" in payload && payload.file ? payload.file : payload
  ) as GeminiFile;
  if (!file.uri) {
    throw geminiFailure("upload_failed", "Gemini did not return a file URI for the recording.");
  }
  return file;
}

async function waitForGeminiFile(
  file: GeminiFile,
  apiKey: string,
  signal?: AbortSignal
): Promise<GeminiFile> {
  let current = file;
  let delay = INITIAL_POLL_DELAY_MS;
  const deadline = Date.now() + FILE_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Transcription cancelled.", "AbortError");
    const state = current.state?.toUpperCase();
    if (!state || state === "ACTIVE") return current;
    if (state === "FAILED") {
      throw geminiFailure(
        "upload_failed",
        current.error?.message || "Gemini could not process the recorded audio."
      );
    }
    if (!current.name) {
      throw geminiFailure("upload_failed", "Gemini did not return a file name for the recording.");
    }

    await sleep(delay, signal);
    current = await requestGeminiJson(
      `${FILES_URL}/${current.name.replace(/^files\//, "")}`,
      apiKey,
      { method: "GET" },
      signal
    ) as GeminiFile;
    delay = Math.min(delay * 2, MAX_POLL_DELAY_MS);
  }

  throw geminiFailure(
    "polling_timeout",
    "Gemini is still processing the recording. Please try again."
  );
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Transcription cancelled.", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Transcription cancelled.", "AbortError"));
      },
      { once: true }
    );
  });
}

async function completeInteraction(
  payload: Record<string, any>,
  apiKey: string,
  signal?: AbortSignal
): Promise<Record<string, any>> {
  let current = payload;
  const id = current.id;
  if (!id || !isPendingInteraction(current)) return current;

  let delay = INITIAL_POLL_DELAY_MS;
  const deadline = Date.now() + INTERACTION_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Transcription cancelled.", "AbortError");
    await sleep(delay, signal);
    current = await requestGeminiJson(
      `${INTERACTIONS_URL}/${id}`,
      apiKey,
      { method: "GET" },
      signal
    );
    if (!isPendingInteraction(current)) return current;
    delay = Math.min(delay * 2, MAX_POLL_DELAY_MS);
  }
  throw geminiFailure(
    "polling_timeout",
    "Gemini is still transcribing the recording. Please try again."
  );
}

async function deleteGeminiFile(file: GeminiFile, apiKey: string): Promise<void> {
  if (!file.name) return;
  const fileId = file.name.replace(/^files\//, "");
  if (!fileId) return;

  const url = `${FILES_URL}/${encodeURIComponent(fileId)}`;
  try {
    const response = await httpClientFor(url)(url, {
      method: "DELETE",
      headers: { "x-goog-api-key": apiKey },
    });
    if (!response.ok) {
      console.warn("[gemini-stt] failed to delete uploaded audio", {
        httpStatus: response.status,
        fileName: file.name,
      });
    }
  } catch (error) {
    console.warn("[gemini-stt] failed to delete uploaded audio", {
      fileName: file.name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Transcribes a completed recording through Gemini's non-streaming batch API.
 * The documented dedicated-transcription flow uses a Gemini Files URI even
 * for short clips, then waits for processing before creating the interaction.
 */
export async function fetchGeminiBatchSTT(
  audio: Blob,
  apiKey: string,
  _endpoint?: string,
  signal?: AbortSignal,
  model?: string
): Promise<string> {
  const normalizedApiKey = normalizeGeminiApiKey(apiKey);
  const transcribeModel = normalizeGeminiTranscribeModel(model);
  if (!normalizedApiKey) {
    throw new Error("Enter a Gemini API key before using Gemini transcription.");
  }
  if (/\s/.test(normalizedApiKey)) {
    throw new Error("The Gemini API key contains spaces. Paste only the key value from Google AI Studio.");
  }
  if (!audio || audio.size === 0) throw new Error("Audio file is empty");
  if (signal?.aborted) throw new DOMException("Transcription cancelled.", "AbortError");

  const mimeType = geminiAudioMimeType(audio.type);
  let uploaded: GeminiFile | null = null;
  try {
    uploaded = await uploadGeminiAudio(audio, mimeType, normalizedApiKey, signal);
    const file = await waitForGeminiFile(uploaded, normalizedApiKey, signal);
    const audioInput = {
      type: "audio",
      uri: file.uri,
      mime_type: file.mime_type || file.mimeType || mimeType,
    };
    if (signal?.aborted) throw new DOMException("Transcription cancelled.", "AbortError");

    const payload = await completeInteraction(
      await requestGeminiJson(
        INTERACTIONS_URL,
        normalizedApiKey,
        {
          method: "POST",
          body: {
            model: transcribeModel,
            input: [audioInput],
            generation_config: { transcription_config: { mode: "smart" } },
          },
        },
        signal
      ),
      normalizedApiKey,
      signal
    );
    const text = extractGeminiTranscribeText(payload);
    if (text) return text;

    const interactionError = Array.isArray(payload.errors)
      ? payload.errors.map((error: { message?: string }) => error.message).filter(Boolean).join(" ")
      : "";
    throw new Error(interactionError || "Gemini returned an empty transcription.");
  } finally {
    if (uploaded) void deleteGeminiFile(uploaded, normalizedApiKey);
  }
}

/** @deprecated Use fetchGeminiBatchSTT. Kept for existing callers. */
export const fetchGeminiLiveSTT = fetchGeminiBatchSTT;
