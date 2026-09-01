export const GEMINI_TRANSCRIBE_PROVIDER_ID = "gemini-transcribe";
export const GEMINI_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";

/**
 * Voice input is intentionally Gemini-only. A finished microphone clip is
 * sent to Gemini's batch transcription API with its real recorded MIME type.
 */
export const SPEECH_TO_TEXT_PROVIDERS = [
  {
    id: GEMINI_TRANSCRIBE_PROVIDER_ID,
    name: "Gemini Transcription",
    curl: `curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \\
      -H "x-goog-api-key: {{API_KEY}}"`,
    responseContentPath: "output_text",
    streaming: false,
  },
];
