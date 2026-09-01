import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

export const TOGGLE_WINDOW_SIZES = {
  compact: { width: 600, height: 54 },
  settings: { width: 600, height: 560 },
} as const;

export type ToggleWindowView = keyof typeof TOGGLE_WINDOW_SIZES;

/**
 * Owns native sizing for views rendered inside the compact assistant window.
 * Keeping these dimensions here prevents dashboard routes from changing the
 * toggle window and gives each compact view one explicit lifecycle.
 */
export const useToggleWindowSize = () => {
  const resizeForView = useCallback(async (view: ToggleWindowView) => {
    const size = TOGGLE_WINDOW_SIZES[view];
    await invoke("resize_main_window", size);
  }, []);

  return { resizeForView };
};
