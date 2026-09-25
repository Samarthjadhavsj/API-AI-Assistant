import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getByPath } from "@/lib/functions/common.function";
import { voiceError } from "@/lib/voice/errors";
import { recordingToWav } from "@/lib/voice/wav";
import { AudioArtifact, SttAdapter, SttResult } from "@/lib/voice/types";

export interface MultipartSttConfig {
  /** Shown in error messages. */
  providerName: string;
  endpoint: string;
  model: string;
  /** Sent as a Bearer token when present. */
  apiKey?: string;
  /** Extra form fields (e.g. Cohere's language). */
  fields?: Record<string, string>;
  /** Where the transcript is in the JSON response; "text" by default. */
  responsePath?: string;
}

export interface MultipartSttDeps {
  fetch: typeof fetch;
  toWav: (blob: Blob) => Promise<Blob>;
}

const isLocalUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
};

/**
 * Public APIs go through Tauri's HTTP client (no CORS). Local servers use the
 * WebView's fetch, as elsewhere in the app, since the app's HTTP scope doesn't
 * cover explicit ports; an address Tauri refuses falls back to it too.
 */
const httpClient: typeof fetch = async (input, init) => {
  const url = String(input);
  if (isLocalUrl(url)) return fetch(url, init);
  try {
    return await (tauriFetch as unknown as typeof fetch)(url, init);
  } catch (error) {
    if (/not allowed/i.test(String((error as Error)?.message ?? error))) return fetch(url, init);
    throw error;
  }
};

const abortError = () => new DOMException("Transcription cancelled.", "AbortError");

/**
 * Speech-to-text through an OpenAI-style transcription endpoint: the finished
 * recording is converted to WAV and uploaded as multipart form data (file +
 * model), and the transcript is read from the JSON response. Used by every
 * voice provider other than Gemini Voice, including Custom.
 */
export class MultipartSttAdapter implements SttAdapter {
  readonly kind = "multipart" as const;
  private readonly deps: MultipartSttDeps;

  constructor(
    readonly providerId: string,
    private readonly config: MultipartSttConfig,
    deps: Partial<MultipartSttDeps> = {}
  ) {
    this.deps = {
      fetch: deps.fetch ?? httpClient,
      toWav: deps.toWav ?? recordingToWav,
    };
  }

  async transcribe(
    artifact: AudioArtifact,
    { signal, onPartial }: { signal: AbortSignal; onPartial?: (text: string) => void }
  ): Promise<SttResult> {
    const { providerName, endpoint, model, apiKey, fields = {}, responsePath } = this.config;
    if (signal.aborted) throw abortError();

    let audio: Blob;
    try {
      audio = await this.deps.toWav(artifact.blob);
    } catch (error) {
      throw voiceError("upload_failed", error, `The recording couldn't be prepared for ${providerName}. Please try again.`);
    }
    if (signal.aborted) throw abortError();

    const form = new FormData();
    form.append("file", audio, "recording.wav");
    form.append("model", model);
    for (const [key, value] of Object.entries(fields)) {
      if (value.trim()) form.append(key, value.trim());
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

    let response: Response;
    try {
      response = await this.deps.fetch(endpoint, { method: "POST", headers, body: form, signal });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) throw abortError();
      throw voiceError(
        "stt_request_failed",
        error,
        isLocalUrl(endpoint)
          ? `Couldn't reach ${providerName}. Check that the server is running and allows requests from the app (CORS).`
          : `Couldn't reach ${providerName}. Check your connection and the endpoint.`
      );
    }

    const raw = await response.text().catch(() => "");
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const rawDetail =
        json?.error?.message ?? json?.message ?? json?.detail ?? (typeof json?.error === "string" ? json.error : "");
      // Providers sometimes echo (part of) the key back; never show it.
      let detail = String(rawDetail).replace(/\S*\*{3,}\S*/g, "[hidden]");
      if (apiKey?.trim()) detail = detail.split(apiKey.trim()).join("[hidden]");
      const reason =
        response.status === 401 || response.status === 403
          ? `${providerName} rejected the API key`
          : response.status === 429
            ? `${providerName} rate limit or quota reached`
            : `${providerName} couldn't transcribe the recording`;
      throw voiceError(
        "stt_request_failed",
        { status: response.status },
        `${reason} (${response.status})${detail ? `: ${detail.slice(0, 160)}` : "."}`
      );
    }

    const text = getByPath(json, responsePath?.trim() || "text");
    if (typeof text !== "string" || !text.trim()) {
      throw voiceError("provider_returned_no_text", json);
    }
    const transcript = text.trim();
    onPartial?.(transcript);
    return { text: transcript, providerId: this.providerId };
  }
}
