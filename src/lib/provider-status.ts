/**
 * Whether a manually configured provider is ready to use, as a short status
 * ("Ready", "API key required", "Model name and API key required") and, for
 * voice input, a sentence saying what to do.
 */
import {
  CUSTOM_VOICE_PROVIDER_ID,
  findVoiceProvider,
} from "@/config/voice-providers.constants";
import { GEMINI_TRANSCRIBE_PROVIDER_ID } from "@/config/stt.constants";
import type { ProviderVariables } from "./provider-settings";

export interface ProviderReadiness {
  ready: boolean;
  /** Short status for settings, e.g. "Ready" or "API key required". */
  status: string;
  /** The provider has no speech-to-text API. */
  unsupported?: boolean;
}

const LABELS: Record<string, string> = { model: "Model name", api_key: "API key", endpoint: "Endpoint URL" };

export const fieldLabel = (key: string): string =>
  LABELS[key] ??
  key
    .split("_")
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");

/** "API key required", "Model name and API key required", … */
export const missingStatus = (keys: string[]): string => {
  const labels = keys.map(fieldLabel);
  if (labels.length === 0) return "Ready";
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `${list} required`;
};

const missingOf = (variables: ProviderVariables, keys: string[]) =>
  keys.filter((key) => !variables[key]?.trim());

/** AI provider: every variable its request template uses must be filled in. */
export const aiProviderReadiness = (requiredKeys: string[], variables: ProviderVariables): ProviderReadiness => {
  // Same order as the fields: model name, API key, then the rest.
  const ordered = [
    ...requiredKeys.filter((k) => k === "model"),
    ...requiredKeys.filter((k) => k === "api_key"),
    ...requiredKeys.filter((k) => k !== "model" && k !== "api_key"),
  ];
  const missing = missingOf(variables, ordered);
  return { ready: missing.length === 0, status: missingStatus(missing) };
};

/** Voice provider (other than Gemini Voice). */
export const voiceProviderReadiness = (providerId: string, variables: ProviderVariables): ProviderReadiness => {
  const provider = findVoiceProvider(providerId);
  if (!provider) return { ready: false, status: "Unknown provider" };
  if (provider.id !== CUSTOM_VOICE_PROVIDER_ID && !provider.endpoint) {
    return { ready: false, status: "No speech-to-text", unsupported: true };
  }
  const required = [
    ...(provider.id === CUSTOM_VOICE_PROVIDER_ID ? ["endpoint"] : []),
    "model",
    ...(provider.apiKeyRequired ? ["api_key"] : []),
    ...provider.fields.filter((f) => f.required && f.key !== "endpoint").map((f) => f.key),
  ];
  const missing = missingOf(variables, required);
  return { ready: missing.length === 0, status: missingStatus(missing) };
};

/**
 * Why voice input can't start with the active voice provider, as a sentence
 * for the user, or null when it can. Gemini Voice keeps its own checks.
 */
export const voiceInputBlocker = (selection: {
  provider?: string;
  variables?: ProviderVariables;
}): { message: string; unsupported: boolean } | null => {
  const providerId = selection.provider || GEMINI_TRANSCRIBE_PROVIDER_ID;
  if (providerId === GEMINI_TRANSCRIBE_PROVIDER_ID) return null;
  const provider = findVoiceProvider(providerId);
  if (!provider) {
    return {
      message: "The selected voice provider isn't available. Choose one in Settings → Voice Transcription.",
      unsupported: true,
    };
  }
  const readiness = voiceProviderReadiness(providerId, selection.variables ?? {});
  if (readiness.unsupported) {
    return {
      message: `${provider.unsupportedReason ?? `${provider.name} can't transcribe speech.`} Choose another voice provider in Settings → Voice Transcription.`,
      unsupported: true,
    };
  }
  if (!readiness.ready) {
    return {
      message: `${provider.name} voice input isn't set up (${readiness.status}). Finish it in Settings → Voice Transcription.`,
      unsupported: false,
    };
  }
  return null;
};
