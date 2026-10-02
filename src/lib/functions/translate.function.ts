import { GEMINI_TRANSLATION_MODEL } from "@/config/gemini-models.constants";
import { DEFAULT_LANGUAGE, LANGUAGES } from "@/lib/response-settings.constants";
import { getResponseSettings } from "@/lib/storage/response-settings.storage";

/** Translation didn't produce text to send. Its message is safe to show (no key, no transcript). */
export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationError";
  }
}

/** The Responses language (Toggle Settings → Responses → Language), or the app's default. */
export const responseLanguageName = (): string => {
  const id = getResponseSettings().language || DEFAULT_LANGUAGE;
  return (
    LANGUAGES.find((language) => language.id === id)?.name ??
    LANGUAGES.find((language) => language.id === DEFAULT_LANGUAGE)?.name ??
    "English"
  );
};

/**
 * Translates `text` into `targetLanguage` with one Gemini request, kept as
 * small as possible: no history, no thinking, deterministic output. The API
 * key goes in a header (never in the URL), and neither the key nor the text is
 * ever logged or put in an error message.
 */
export async function translateText({
  text,
  targetLanguage,
  apiKey,
  signal,
}: {
  text: string;
  targetLanguage: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<string> {
  if (!apiKey.trim()) {
    throw new TranslationError("Add a Gemini API key in Settings → Voice Transcription to translate.");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TRANSLATION_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `Translate the user's text into ${targetLanguage}. Reply with the translation only: no quotes, notes or explanations. If it is already in ${targetLanguage}, return it unchanged.`,
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0 },
        }),
        signal,
      }
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new TranslationError("Couldn't reach the translation service. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new TranslationError(
      response.status === 400 || response.status === 401 || response.status === 403
        ? "Translation was refused. Check the Gemini API key in Settings → Voice Transcription."
        : response.status === 429
          ? "Translation is rate-limited right now. Try again in a moment."
          : `Translation failed (${response.status}). Try again.`
    );
  }

  let translated = "";
  try {
    const json = await response.json();
    translated = (json?.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: unknown }) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  } catch {
    throw new TranslationError("Translation came back unreadable. Try again.");
  }
  if (!translated) throw new TranslationError("Translation came back empty. Try again.");
  return translated;
}
