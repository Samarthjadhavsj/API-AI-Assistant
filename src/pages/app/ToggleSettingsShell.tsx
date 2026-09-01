import type { ReactNode } from "react";
import { ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ScrollArea } from "@/components";

interface ToggleSettingsShellProps {
  title: string;
  description: string;
  backTo: string;
  children: ReactNode;
}

/** Shared shell for settings views inside the existing toggle webview. */
export const ToggleSettingsShell = ({ title, description, backTo, children }: ToggleSettingsShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen" data-view="toggle">
      <Card className="h-full gap-0 rounded-none border-0 py-0 shadow-none">
        <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3" data-tauri-drag-region={true}>
          <Button aria-label="Go back" data-tauri-drag-region={false} onClick={() => navigate(backTo)} size="icon" title="Go back" variant="ghost">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <SettingsIcon className="size-4 text-muted-foreground" />
          <div>
            <h1 className="text-sm font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-7 px-4 py-5">{children}</div>
        </ScrollArea>
      </Card>
    </div>
  );
};
