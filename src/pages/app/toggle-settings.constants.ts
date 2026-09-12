import type { ElementType } from "react";
import {
  BotIcon,
  MicIcon,
  PaletteIcon,
} from "lucide-react";

export const TOGGLE_SETTINGS_SECTIONS = [
  { id: "appearance", title: "Appearance", description: "Theme, window behavior, and visual preferences.", icon: PaletteIcon },
  { id: "providers", title: "AI Providers", description: "Configure your AI provider and API settings.", icon: BotIcon },
  { id: "speech", title: "Voice Transcription", description: "Configure microphone and speech-to-text settings.", icon: MicIcon },
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