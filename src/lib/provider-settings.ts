/**
 * Saved settings for every AI provider, not just the active one.
 *
 * The active provider is still stored as before ({ provider, variables } under
 * "curl_selected_ai_provider"), and that is what requests use. Alongside it,
 * each provider's own variables (API key, model, …) are kept in a map, so
 * switching provider never erases another provider's settings and switching
 * back restores them.
 */

export type ProviderVariables = Record<string, string>;
export type AiProviderConfigs = Record<string, ProviderVariables>;

export interface ActiveProviderSelection {
  provider: string;
  variables: ProviderVariables;
}

export const GEMINI_AI_PROVIDER_ID = "gemini";
/** Gemini Voice's provider ID (see stt.constants). */
export const GEMINI_VOICE_PROVIDER_ID = "gemini-transcribe";

const parseJson = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const toVariables = (value: unknown): ProviderVariables | null => {
  if (!isPlainObject(value)) return null;
  const variables: ProviderVariables = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") variables[key] = entry;
  }
  return variables;
};

/**
 * Restores every provider's saved settings. The active selection wins for its
 * own provider, which also carries over installs that only saved that.
 * `builtInId` is the built-in provider, which never counts as an "other" one.
 */
export function restoreProviderSettings({
  configsRaw,
  otherProviderRaw,
  active,
  builtInId,
}: {
  configsRaw: string | null;
  otherProviderRaw: string | null;
  active: ActiveProviderSelection | null;
  builtInId: string;
}): { configs: AiProviderConfigs; otherProviderId: string } {
  const configs: AiProviderConfigs = {};
  const parsed = parseJson(configsRaw);
  if (isPlainObject(parsed)) {
    for (const [id, value] of Object.entries(parsed)) {
      const variables = toVariables(value);
      if (id && variables) configs[id] = variables;
    }
  }

  if (active?.provider) {
    configs[active.provider] = { ...(toVariables(active.variables) ?? {}) };
  }

  // A plain provider ID (anything else, e.g. an old JSON object, is ignored)
  const savedOther =
    typeof otherProviderRaw === "string" && /^[\w.:-]+$/.test(otherProviderRaw.trim())
      ? otherProviderRaw.trim()
      : "";
  const otherProviderId =
    savedOther && savedOther !== builtInId
      ? savedOther
      : active?.provider && active.provider !== builtInId
        ? active.provider
        : "";

  return { configs, otherProviderId };
}

export const restoreAiProviderSettings = (args: {
  configsRaw: string | null;
  otherProviderRaw: string | null;
  active: ActiveProviderSelection | null;
}) => restoreProviderSettings({ ...args, builtInId: GEMINI_AI_PROVIDER_ID });

export const restoreVoiceProviderSettings = (args: {
  configsRaw: string | null;
  otherProviderRaw: string | null;
  active: ActiveProviderSelection | null;
}) => restoreProviderSettings({ ...args, builtInId: GEMINI_VOICE_PROVIDER_ID });
