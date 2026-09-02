import { ShortcutAction } from "@/types";

export const DEFAULT_SHORTCUT_ACTIONS: ShortcutAction[] = [
  {
    id: "toggle_window",
    name: "Toggle Window",
    description: "Show/Hide the main window",
    defaultKey: {
      macos: "shift+backslash",
      windows: "shift+backslash",
      linux: "shift+backslash",
    },
  },
  {
    id: "toggle_updates",
    name: "Toggle Updates",
    description: "Toggle update notifications",
    defaultKey: {
      macos: "shift+backspace",
      windows: "shift+backspace",
      linux: "shift+backspace",
    },
  },
];
