import { describe, expect, it, vi } from "vitest";
import {
  shouldIgnoreVoiceShortcut,
  submitVoiceTranscript,
} from "./VoiceInputButton";

describe("VoiceComposer voice result routing", () => {
  it("submits a successful transcript through the existing completion submit flow", async () => {
    const submit = vi.fn(async () => undefined);
    const focusInput = vi.fn();

    await submitVoiceTranscript("Existing prompt", "  spoken follow-up  ", submit, focusInput);

    expect(focusInput).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith("Existing prompt spoken follow-up");
  });

  it("ignores the shortcut when another surface owns the active recording", () => {
    expect(
      shouldIgnoreVoiceShortcut({
        activeOwnerId: "chat-recorder",
        isActiveSessionOwner: false,
      })
    ).toBe(true);
    expect(
      shouldIgnoreVoiceShortcut({
        activeOwnerId: "overlay-recorder",
        isActiveSessionOwner: true,
      })
    ).toBe(false);
  });
});
