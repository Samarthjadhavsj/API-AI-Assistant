import { TYPE_PROVIDER } from "@/types";
import { SttAdapter } from "@/lib/voice/types";
import {
  GEMINI_TRANSCRIBE_PROVIDER_ID,
  GEMINI_TRANSCRIBE_MODEL,
  GEMINI_TRANSCRIBE_LIVE_MODEL
} from "@/config/stt.constants";
import { GeminiBatchSttAdapter } from "./GeminiBatchSttAdapter";
import { GeminiLiveSttAdapter } from "./GeminiLiveSttAdapter";

export function createSttAdapter(
  provider: TYPE_PROVIDER | undefined,
  selectedProvider: { provider: string; variables: Record<string, string> }
): SttAdapter | null {
  if (
    !provider ||
    provider.id !== GEMINI_TRANSCRIBE_PROVIDER_ID ||
    selectedProvider.provider !== GEMINI_TRANSCRIBE_PROVIDER_ID ||
    !selectedProvider.variables.api_key?.trim()
  ) {
    return null;
  }

  // Determine the model: use configured model or fall back to batch model
  const configuredModel = selectedProvider.variables.model || GEMINI_TRANSCRIBE_MODEL;

  // Return live adapter for live model, batch adapter otherwise
  if (configuredModel === GEMINI_TRANSCRIBE_LIVE_MODEL) {
    return new GeminiLiveSttAdapter(GEMINI_TRANSCRIBE_PROVIDER_ID, {
      api_key: selectedProvider.variables.api_key,
      model: configuredModel,
    });
  }

  // Default to batch adapter (including explicit batch model and fallback)
  return new GeminiBatchSttAdapter(GEMINI_TRANSCRIBE_PROVIDER_ID, {
    api_key: selectedProvider.variables.api_key,
    model: GEMINI_TRANSCRIBE_MODEL,
  });
}
