import { TYPE_PROVIDER } from "@/types";
import { SttAdapter } from "@/lib/voice/types";
import {
  GEMINI_TRANSCRIBE_PROVIDER_ID,
  GEMINI_TRANSCRIBE_MODEL,
} from "@/config/stt.constants";
import { geminiLiveProfileFor } from "@/config/gemini-models.constants";
import {
  CUSTOM_VOICE_PROVIDER_ID,
  findVoiceProvider,
} from "@/config/voice-providers.constants";
import { voiceProviderReadiness } from "@/lib/provider-status";
import { GeminiBatchSttAdapter } from "./GeminiBatchSttAdapter";
import { GeminiLiveSttAdapter } from "./GeminiLiveSttAdapter";
import { MultipartSttAdapter } from "./MultipartSttAdapter";

export function createSttAdapter(
  provider: TYPE_PROVIDER | undefined,
  selectedProvider: { provider: string; variables: Record<string, string> }
): SttAdapter | null {
  if (!provider || provider.id !== selectedProvider.provider) return null;

  if (provider.id !== GEMINI_TRANSCRIBE_PROVIDER_ID) {
    return createOtherProviderAdapter(selectedProvider.provider, selectedProvider.variables);
  }

  if (!selectedProvider.variables.api_key?.trim()) return null;

  // The configured voice model, or the batch model when none is set
  const configuredModel = selectedProvider.variables.model?.trim() || GEMINI_TRANSCRIBE_MODEL;

  // Live models (every model in the Voice list, or a custom Live model ID)
  // stream audio over a WebSocket, set up for that model.
  const liveProfile = geminiLiveProfileFor(configuredModel);
  if (liveProfile) {
    return new GeminiLiveSttAdapter(
      GEMINI_TRANSCRIBE_PROVIDER_ID,
      { api_key: selectedProvider.variables.api_key, model: configuredModel },
      liveProfile
    );
  }

  // Any other model ID transcribes a recorded clip in one request.
  return new GeminiBatchSttAdapter(GEMINI_TRANSCRIBE_PROVIDER_ID, {
    api_key: selectedProvider.variables.api_key,
    model: configuredModel,
  });
}

/**
 * A voice provider other than Gemini: its own transcription endpoint, model
 * and key. No adapter when the provider has no speech-to-text API or isn't
 * set up; voice input then says why (never falls back to Gemini).
 */
function createOtherProviderAdapter(
  providerId: string,
  variables: Record<string, string>
): SttAdapter | null {
  const definition = findVoiceProvider(providerId);
  if (!definition || !voiceProviderReadiness(providerId, variables).ready) return null;

  const isCustom = providerId === CUSTOM_VOICE_PROVIDER_ID;
  const endpoint = isCustom ? variables.endpoint?.trim() : definition.endpoint;
  if (!endpoint) return null;

  const fields = Object.fromEntries(
    definition.fields
      .filter((field) => !isCustom || (field.key !== "endpoint" && field.key !== "response_path"))
      .map((field) => [field.key, variables[field.key] ?? ""])
  );

  return new MultipartSttAdapter(providerId, {
    providerName: isCustom ? variables.name?.trim() || "Custom voice provider" : definition.name,
    endpoint,
    model: variables.model.trim(),
    apiKey: variables.api_key,
    fields,
    responsePath: isCustom ? variables.response_path : undefined,
  });
}
