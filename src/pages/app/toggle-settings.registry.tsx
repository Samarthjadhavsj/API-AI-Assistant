import type { ComponentType } from "react";
import { useSettings } from "@/hooks";
import { AIProviders, STTProviders } from "@/pages/dev/components";
import {
  AutoScrollToggle,
  LanguageSelector,
  ResponseLength,
} from "@/pages/responses/components";
import { ScreenshotConfigs } from "@/pages/screenshot/components";
import { AudioSelection } from "@/pages/audio/components";
import {
  CursorSelection,
  ShortcutManager,
} from "@/pages/shortcuts/components";
import { SystemPromptsContent } from "@/pages/system-prompts";
import {
  AlwaysOnTopToggle,
  AppIconToggle,
  AutostartToggle,
  Theme,
} from "@/pages/settings/components";
import type { ToggleSettingsSectionId } from "./toggle-settings.constants";

const AppearanceSettings = () => (
  <>
    <Theme />
    <AutostartToggle />
    <AppIconToggle />
    <AlwaysOnTopToggle />
  </>
);

const ProviderSettings = () => {
  const settings = useSettings();
  return <AIProviders {...settings} />;
};

/** Kept separate so microphone setup is never buried below AI-provider UI. */
const SpeechToTextSettings = () => {
  const settings = useSettings();
  return <STTProviders {...settings} />;
};

const ResponseSettings = () => (
  <>
    <ResponseLength />
    <LanguageSelector />
    <AutoScrollToggle />
  </>
);

const ScreenshotSettings = () => {
  const settings = useSettings();
  return <ScreenshotConfigs {...settings} />;
};

const ShortcutSettings = () => (
  <>
    <CursorSelection />
    <ShortcutManager />
  </>
);

/**
 * Every compact setting has exactly one feature component. `satisfies Record`
 * makes TypeScript fail the build whenever a new section is added without a
 * compact implementation.
 */
export const TOGGLE_SETTINGS_CONTENT = {
  appearance: AppearanceSettings,
  providers: ProviderSettings,
  "pluely-access": ProviderSettings,
  speech: SpeechToTextSettings,
  responses: ResponseSettings,
  screenshot: ScreenshotSettings,
  audio: AudioSelection,
  shortcuts: ShortcutSettings,
  prompts: SystemPromptsContent,
} satisfies Record<ToggleSettingsSectionId, ComponentType>;
