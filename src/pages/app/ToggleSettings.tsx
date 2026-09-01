import { ChevronRightIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components";
import { TOGGLE_SETTINGS_SECTIONS } from "./toggle-settings.constants";
import { ToggleSettingsShell } from "./ToggleSettingsShell";

/** Landing page for every configurable dashboard feature in the compact toggle. */
const ToggleSettings = () => {
  const navigate = useNavigate();

  return (
    <ToggleSettingsShell
      backTo="/"
      description="Choose a settings category. Changes apply immediately."
      title="Toggle Settings"
    >
      <div className="space-y-2">
        {TOGGLE_SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Button
              className="h-auto w-full justify-start gap-3 px-3 py-3 text-left"
              data-tauri-drag-region={false}
              key={section.id}
              onClick={() => navigate(`/toggle/settings/${section.id}`)}
              variant="outline"
            >
              <Icon className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{section.title}</span>
                <span className="mt-0.5 block whitespace-normal text-xs font-normal text-muted-foreground">
                  {section.description}
                </span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Button>
          );
        })}
      </div>
    </ToggleSettingsShell>
  );
};

export default ToggleSettings;
