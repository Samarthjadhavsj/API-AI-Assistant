import { Card, DragButton, CustomCursor, Button } from "@/components";
import {
  Completion,
} from "./components";
import { useApp } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { XIcon, SettingsIcon } from "lucide-react";
import { emit } from "@tauri-apps/api/event";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { getPlatform } from "@/lib";
import { useNavigate } from "react-router-dom";

const App = () => {
  const { isHidden } = useApp();
  const { customizable } = useAppContext();
  const platform = getPlatform();
  const navigate = useNavigate();

  const hideWindow = async () => {
    try {
      // Just emit the event - don't update isHidden state
      // The Rust backend will handle hiding the window
      await emit("hide-window-clicked", {});
    } catch (error) {
      console.error("Failed to hide window:", error);
    }
  };

  const openSettings = () => navigate("/toggle/settings");

  return (
    <ErrorBoundary
      fallbackRender={() => {
        return <ErrorLayout isCompact />;
      }}
      resetKeys={["app-error"]}
      onReset={() => {
        console.log("Reset");
      }}
    >
      <div
        className="w-screen h-screen flex overflow-hidden justify-center items-start"
      >
        <Card className="w-full flex flex-row items-center gap-2 p-2">
          <div className="w-full flex flex-row gap-2 items-center">
            <Completion isHidden={isHidden} />
            <div className="flex gap-2 relative z-50" style={{ pointerEvents: 'auto' }} data-tauri-drag-region={false}>
              <Button
                size={"icon"}
                variant={"ghost"}
                className="cursor-pointer h-8 w-8 shrink-0"
                title="Open Settings"
                onClick={openSettings}
                data-tauri-drag-region={false}
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
              <Button
                size={"icon"}
                variant={"ghost"}
                className="cursor-pointer h-8 w-8 shrink-0"
                title="Hide window (Shift+\ to show again)"
                onClick={hideWindow}
                data-tauri-drag-region={false}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DragButton />
        </Card>
        {customizable.cursor.type === "invisible" && platform !== "linux" ? (
          <CustomCursor />
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

export default App;
