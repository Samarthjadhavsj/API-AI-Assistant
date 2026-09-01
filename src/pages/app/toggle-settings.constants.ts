import type { ElementType } from "react";
import {
  BotIcon,
  KeyRoundIcon,
  MessageSquareTextIcon,
  PaletteIcon,
  MousePointer2Icon,
} from "lucide-react";

export const TOGGLE_SETTINGS_SECTIONS = [
  { id: "appearance", title: "Appearance", description: "Theme, window behavior, and visual preferences.", icon: PaletteIcon },
  { id: "providers", title: "AI Providers", description: "Configure your AI provider and API settings.", icon: BotIcon },
  { id: "hey-frank-access", title: "API Keys", description: "Manage your AI provider API keys and configuration.", icon: KeyRoundIcon },
  { id: "responses", title: "Response Settings", description: "Customize AI response behavior and preferences.", icon: MessageSquareTextIcon },
  { id: "shortcuts", title: "Keyboard Shortcuts", description: "Configure global keyboard shortcuts and hotkeys.", icon: MousePointer2Icon },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  icon: ElementType;
}>;

export type ToggleSettingsSectionId = (typeof TOGGLE_SETTINGS_SECTIONS)[number]["id"];