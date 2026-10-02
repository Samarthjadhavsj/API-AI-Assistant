import { UseCompletionReturn } from "@/types";
import { Files } from "./Files";
import { Input } from "./Input";
import { Screenshot } from "./Screenshot";

export { submitVoiceTranscript } from "./voice-submit";

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
  // Screenshot and Attach live inside the input bar (the response panel's
  // anchor), so using them never dismisses and resets the visible answer.
  return (
    <Input
      {...completion}
      isHidden={isHidden}
      onVoiceStateChange={onVoiceStateChange}
      trailingControls={
        <>
          <Screenshot {...completion} />
          <Files {...completion} />
        </>
      }
    />
  );
};