import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useApp } from "@/contexts";
import { createSttAdapter } from "@/lib/stt";
import { voiceError } from "@/lib/voice/errors";
import { voiceInputBlocker } from "@/lib/provider-status";
import { voiceRecorderController } from "@/lib/voice/VoiceRecorderController";
import { SttResult } from "@/lib/voice/types";

let nextOwnerId = 0;
let shortcutToggle: (() => void) | null = null;

export function registerVoiceShortcutToggle(handler: () => void) {
  shortcutToggle = handler;
  return () => {
    if (shortcutToggle === handler) shortcutToggle = null;
  };
}

export function invokeVoiceShortcutToggle() {
  shortcutToggle?.();
}

interface UseVoiceInputOptions {
  maxDurationMs?: number;
  onPartial?: (text: string) => void;
  onResult?: (result: SttResult) => void;
}

/** React adapter for the one shared, framework-independent voice session. */
export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const snapshot = useSyncExternalStore(
    voiceRecorderController.subscribe,
    voiceRecorderController.getSnapshot,
    voiceRecorderController.getSnapshot
  );
  const { selectedSttProvider, allSttProviders } = useApp();
  const ownerId = useRef(`voice-input-${++nextOwnerId}`);
  const configuration = useRef({ selectedSttProvider, allSttProviders, options });
  const partialListener = useRef(options.onPartial);
  const resultListener = useRef(options.onResult);
  configuration.current = { selectedSttProvider, allSttProviders, options };
  partialListener.current = options.onPartial;
  resultListener.current = options.onResult;

  useEffect(() => {
    return () => {
      // The recorder is application-scoped. A temporary surface change (for
      // example hiding the overlay) must not silently stop an active session.
      // The controller remains available to every other mounted surface and
      // only app-level teardown should dispose it.
      partialListener.current = undefined;
      resultListener.current = undefined;
    };
  }, []);

  const start = useCallback((deviceId?: string) => {
    const current = configuration.current;
    // Another voice provider that can't transcribe (or isn't set up) is
    // reported before recording, never replaced by Gemini.
    const blocker = voiceInputBlocker(current.selectedSttProvider);
    if (blocker) {
      return Promise.reject(
        voiceError(blocker.unsupported ? "provider_unsupported" : "provider_not_configured", undefined, blocker.message)
      );
    }
    const provider = current.allSttProviders.find(
      (item) => item.id === current.selectedSttProvider.provider
    );
    return voiceRecorderController.start({
      adapter: createSttAdapter(provider, current.selectedSttProvider),
      deviceId,
      maxDurationMs: current.options.maxDurationMs,
      ownerId: ownerId.current,
      onPartial: (text) => partialListener.current?.(text),
      onResult: (result) => resultListener.current?.(result),
    });
  }, []);

  const stop = useCallback(() => voiceRecorderController.stop(ownerId.current), []);
  const cancel = useCallback(() => voiceRecorderController.cancel(ownerId.current), []);

  const toggle = useCallback(
    async (deviceId?: string) => {
      const current = voiceRecorderController.getSnapshot();
      if (current.activeOwnerId && current.activeOwnerId !== ownerId.current) {
        throw voiceError("recording_already_active");
      }
      if (current.state === "requestingPermission") {
        cancel();
        return null;
      }
      if (current.state === "recording" || current.state === "finalizing") {
        return stop();
      }
      if (current.state === "transcribing") return null;
      await start(deviceId);
      return null;
    },
    [cancel, start, stop]
  );

  return {
    ...snapshot,
    isActiveSessionOwner: snapshot.activeOwnerId === ownerId.current,
    start,
    stop,
    cancel,
    toggle,
  };
}
