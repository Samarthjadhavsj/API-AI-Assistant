/**
 * Voice (speech-to-text) providers other than Gemini Voice, listed under
 * Voice Transcription → Other voice providers, in the same order as the AI
 * providers, with Custom last.
 *
 * Supported providers take an OpenAI-style multipart upload (file + model,
 * Bearer key) and return JSON with the transcript in `text`. Endpoints are
 * from each provider's API docs. Providers without a speech-to-text API are
 * listed with the reason, so choosing one explains itself instead of quietly
 * falling back to Gemini.
 */

export interface VoiceProviderField {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  required: boolean;
}

export interface VoiceProviderDefinition {
  id: string;
  name: string;
  /** Transcription endpoint, or null when the provider has no speech-to-text API. */
  endpoint: string | null;
  /** Why the provider can't be used for voice (when endpoint is null). */
  unsupportedReason?: string;
  modelPlaceholder?: string;
  /** Provider-specific form fields sent with the upload (besides model). */
  fields: VoiceProviderField[];
  apiKeyRequired: boolean;
}

export const CUSTOM_VOICE_PROVIDER_ID = "custom";

export const VOICE_PROVIDERS: readonly VoiceProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    modelPlaceholder: "e.g. gpt-transcribe or whisper-1",
    fields: [],
    apiKeyRequired: true,
  },
  {
    id: "claude",
    name: "Claude",
    endpoint: null,
    unsupportedReason: "Claude's API doesn't accept audio, so it can't transcribe speech.",
    fields: [],
    apiKeyRequired: true,
  },
  {
    id: "grok",
    name: "Grok",
    endpoint: "https://api.x.ai/v1/stt",
    modelPlaceholder: "e.g. grok-voice-transcribe-2.0",
    fields: [],
    apiKeyRequired: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    endpoint: "https://api.mistral.ai/v1/audio/transcriptions",
    modelPlaceholder: "e.g. voxtral-mini-latest",
    fields: [],
    apiKeyRequired: true,
  },
  {
    id: "cohere",
    name: "Cohere",
    endpoint: "https://api.cohere.com/v2/audio/transcriptions",
    modelPlaceholder: "e.g. cohere-transcribe-03-2026",
    fields: [
      {
        key: "language",
        label: "Language",
        placeholder: "e.g. en",
        hint: "Cohere needs the spoken language as a two-letter code.",
        required: true,
      },
    ],
    apiKeyRequired: true,
  },
  {
    id: "groq",
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    modelPlaceholder: "e.g. whisper-large-v3-turbo",
    fields: [],
    apiKeyRequired: true,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    endpoint: null,
    unsupportedReason: "Perplexity's API has no speech-to-text.",
    fields: [],
    apiKeyRequired: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/audio/transcriptions",
    modelPlaceholder: "e.g. openai/whisper-1",
    fields: [],
    apiKeyRequired: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    endpoint: null,
    unsupportedReason: "Ollama doesn't offer a speech-to-text API.",
    fields: [],
    apiKeyRequired: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: null,
    unsupportedReason: "DeepSeek's API has no speech-to-text.",
    fields: [],
    apiKeyRequired: true,
  },
];

/** Custom: any OpenAI-style transcription endpoint (e.g. a self-hosted Whisper server). */
export const CUSTOM_VOICE_PROVIDER: VoiceProviderDefinition = {
  id: CUSTOM_VOICE_PROVIDER_ID,
  name: "Custom",
  endpoint: null,
  modelPlaceholder: "Model name or ID the endpoint expects",
  fields: [
    {
      key: "endpoint",
      label: "Endpoint URL",
      placeholder: "https://…/v1/audio/transcriptions",
      hint: "Receives the recording as a multipart upload (file + model).",
      required: true,
    },
    {
      key: "response_path",
      label: "Transcript field",
      placeholder: "text",
      hint: "Where the transcript is in the JSON response. Leave empty for \"text\".",
      required: false,
    },
  ],
  apiKeyRequired: false,
};

export const findVoiceProvider = (id: string | undefined): VoiceProviderDefinition | undefined =>
  id === CUSTOM_VOICE_PROVIDER_ID ? CUSTOM_VOICE_PROVIDER : VOICE_PROVIDERS.find((p) => p.id === id);
