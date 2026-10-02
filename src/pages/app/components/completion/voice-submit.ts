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
