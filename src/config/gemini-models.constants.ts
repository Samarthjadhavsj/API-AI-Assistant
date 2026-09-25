/**
 * Gemini models offered in Settings → AI Providers, with their free-tier
 * quotas. Lists are ordered by quota, highest first:
 * - AI Response: requests per day (RPD); equal RPD keeps the listed order.
 * - Voice: every Live model has unlimited RPD, so tokens per minute (TPM).
 * "Custom model" (any other model ID) always comes last, in the UI.
 */

export interface GeminiModelQuota {
  /** Requests per day; "unlimited" for Live models. */
  rpd: number | "unlimited";
  /** Tokens per minute, when it's what sets the models apart. */
  tpm?: number;
}

export interface GeminiModelOption {
  /** Model ID sent to the Gemini API. */
  id: string;
  /** Name shown in the dropdown. */
  name: string;
  quota: GeminiModelQuota;
}

/** How a Live model is driven for dictation (see GeminiLiveSttAdapter). */
export interface GeminiLiveVoiceProfile {
  /** Response modality the model accepts; native-audio models only take AUDIO. */
  responseModality: "TEXT" | "AUDIO";
  /** Required by extended-thinking models. */
  thinkingLevel?: "low";
  /**
   * "segments": interim + final transcript segments (Transcribe Live).
   * "stream": transcript arrives as deltas to append as-is; speech start/end
   * are marked explicitly, so tapping Done right after speaking still ends the
   * turn (automatic voice detection would wait for a pause).
   */
  transcript: "segments" | "stream";
  /** Silence streamed in real time before ending, so the last words are transcribed. */
  trailingSilenceMs?: number;
  /** After the end, how long without new transcript before it's complete. */
  settleMs?: number;
}

export interface GeminiVoiceModelOption extends GeminiModelOption {
  live: GeminiLiveVoiceProfile;
}

export const GEMINI_RESPONSE_MODELS: readonly GeminiModelOption[] = [
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", quota: { rpd: 500 } },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", quota: { rpd: 500 } },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", quota: { rpd: 20 } },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", quota: { rpd: 20 } },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", quota: { rpd: 20 } },
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", quota: { rpd: 20 } },
];

const STREAM_AUDIO: GeminiLiveVoiceProfile = {
  responseModality: "AUDIO",
  transcript: "stream",
  settleMs: 600,
};

export const GEMINI_VOICE_MODELS: readonly GeminiVoiceModelOption[] = [
  {
    id: "gemini-2.5-flash-native-audio-preview-12-2025",
    name: "Gemini 2.5 Flash Native Audio Dialog",
    quota: { rpd: "unlimited", tpm: 1_000_000 },
    // Sends the transcript word by word, spread over ~1.5 s after speech ends.
    live: { ...STREAM_AUDIO, settleMs: 1500 },
  },
  {
    id: "gemini-3.1-flash-live-preview",
    name: "Gemini 3 Flash Live",
    quota: { rpd: "unlimited", tpm: 65_000 },
    live: STREAM_AUDIO,
  },
  {
    id: "gemini-3.8-live",
    name: "Gemini 3.8 Live",
    quota: { rpd: "unlimited", tpm: 65_000 },
    live: STREAM_AUDIO,
  },
  {
    id: "gemini-3.8-live-extended-thinking",
    name: "Gemini 3.8 Live Extended Thinking",
    quota: { rpd: "unlimited", tpm: 65_000 },
    live: { ...STREAM_AUDIO, thinkingLevel: "low" },
  },
  {
    id: "gemini-3.5-live-translate-preview",
    name: "Gemini 3.5 Live Translate",
    quota: { rpd: "unlimited", tpm: 20_000 },
    live: { responseModality: "TEXT", transcript: "stream", trailingSilenceMs: 1200, settleMs: 800 },
  },
  {
    id: "gemini-3.5-transcribe-live",
    name: "Gemini 3.5 Transcribe Live",
    quota: { rpd: "unlimited", tpm: 20_000 },
    live: { responseModality: "TEXT", transcript: "segments" },
  },
];

const formatTokens = (tpm: number) =>
  tpm >= 1_000_000 ? `${tpm / 1_000_000}M` : `${Math.round(tpm / 1000)}K`;

/** Short quota label, e.g. "500 requests/day" or "Unlimited · 65K tokens/min". */
export const formatGeminiQuota = ({ rpd, tpm }: GeminiModelQuota): string => {
  const requests = rpd === "unlimited" ? "Unlimited" : `${rpd} requests/day`;
  return rpd === "unlimited" && tpm ? `${requests} · ${formatTokens(tpm)} tokens/min` : requests;
};

export const findGeminiModel = <T extends GeminiModelOption>(
  models: readonly T[],
  id: string | undefined
): T | undefined => models.find((model) => model.id === id?.trim());

/**
 * Live profile for a voice model ID: the listed profile, or a best guess for a
 * custom ID. Returns null for IDs that aren't Live models (batch transcription).
 */
export const geminiLiveProfileFor = (id: string | undefined): GeminiLiveVoiceProfile | null => {
  const model = id?.trim() ?? "";
  if (!model) return null;
  const listed = findGeminiModel(GEMINI_VOICE_MODELS, model);
  if (listed) return listed.live;
  if (/(^|-)transcribe-live(-|$)/.test(model)) return { responseModality: "TEXT", transcript: "segments" };
  // Other Live / native-audio models only answer in audio; wait longer for the
  // transcript since how it arrives isn't known.
  if (/(^|-)live(-|$)|native-audio/.test(model)) return { ...STREAM_AUDIO, settleMs: 1500 };
  return null;
};
