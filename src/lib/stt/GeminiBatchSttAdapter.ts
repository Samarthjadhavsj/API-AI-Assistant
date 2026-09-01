import { fetchGeminiBatchSTT } from "@/lib/functions/gemini-live-stt.function";
import { AudioArtifact, SttAdapter, SttResult } from "@/lib/voice/types";

/**
 * Gemini's non-streaming transcription workflow: capture a complete local
 * Blob, then submit it as one batch request after the microphone is released.
 */
export class GeminiBatchSttAdapter implements SttAdapter {
  readonly kind = "multipart" as const;

  constructor(
    readonly providerId: string,
    private readonly variables: Record<string, string>
  ) {}

  async transcribe(
    artifact: AudioArtifact,
    { signal, onPartial }: { signal: AbortSignal; onPartial?: (text: string) => void }
  ): Promise<SttResult> {
    if (signal.aborted) throw new DOMException("Transcription cancelled.", "AbortError");
    const text = await fetchGeminiBatchSTT(
      artifact.blob,
      this.variables.api_key || "",
      undefined,
      signal,
      this.variables.model
    );
    if (signal.aborted) throw new DOMException("Transcription cancelled.", "AbortError");
    // Kept for the shared adapter contract. Batch mode calls it once, after
    // the complete transcript is available; it never emits live partials.
    onPartial?.(text);
    return { text, providerId: this.providerId };
  }
}
