import type { ElementType } from "react";
import {
  BotIcon,
  PaletteIcon,
} from "lucide-react";

export const TOGGLE_SETTINGS_SECTIONS = [
  { id: "appearance", title: "Appearance", description: "Theme, window behavior, and visual preferences.", icon: PaletteIcon },
  { id: "providers", title: "AI Providers", description: "Configure your AI provider and API settings.", icon: BotIcon },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  icon: ElementType;
}>;

export type ToggleSettingsSectionId = 
  | (typeof TOGGLE_SETTINGS_SECTIONS)[number]["id"]
  | "hey-frank-access"
  | "responses"
  | "shortcuts"
  | "speech"
  | "screenshot"
  | "audio"
  | "prompts";