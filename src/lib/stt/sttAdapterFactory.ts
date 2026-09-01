import { TYPE_PROVIDER } from "@/types";
import { SttAdapter } from "@/lib/voice/types";
import { GEMINI_TRANSCRIBE_PROVIDER_ID, GEMINI_TRANSCRIBE_MODEL } from "@/config/stt.constants";
import { GeminiBatchSttAdapter } from "./GeminiBatchSttAdapter";

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

  return new GeminiBatchSttAdapter(GEMINI_TRANSCRIBE_PROVIDER_ID, {
    api_key: selectedProvider.variables.api_key,
    model: GEMINI_TRANSCRIBE_MODEL,
  });
}
