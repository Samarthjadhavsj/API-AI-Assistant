import { UseCompletionReturn } from "@/types";
import { Files } from "./Files";
import { Input } from "./Input";
import { Screenshot } from "./Screenshot";

/**
 * Submits a voice transcript by appending it to the existing prompt.
 * @param existingPrompt - The current prompt text
 * @param transcript - The voice transcript to append
 * @param submit - The completion submit function
 * @param focusInput - Function to focus the input field
 */
export const submitVoiceTranscript = async (
  existingPrompt: string,
  transcript: string,
  submit: (prompt: string) => Promise<void>,
  focusInput: () => void
) => {
  focusInput();
  const combinedPrompt = (existingPrompt + " " + transcript.trim()).trim();
  await submit(combinedPrompt);
};

/**
 * Determines whether to ignore a voice shortcut based on recording ownership.
 * @param params - Object containing activeOwnerId and isActiveSessionOwner
 * @returns true if the shortcut should be ignored, false otherwise
 */
export const shouldIgnoreVoiceShortcut = ({
  activeOwnerId,
  isActiveSessionOwner,
}: {
  activeOwnerId: string | null;
  isActiveSessionOwner: boolean;
}): boolean => {
  // Ignore if another surface owns the recording (not this session owner)
  return activeOwnerId !== null && !isActiveSessionOwner;
};

/** Simplified composer with voice recording */
export const VoiceComposer = ({
  isHidden,
  onVoiceStateChange,
  ...completion
}: UseCompletionReturn & { isHidden: boolean; onVoiceStateChange?: (state: string) => void }) => {
  return (
    <>
      <Input {...completion} isHidden={isHidden} onVoiceStateChange={onVoiceStateChange} />
      <Screenshot {...completion} />
      <Files {...completion} />
    </>
  );
};