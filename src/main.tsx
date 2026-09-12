import React from "react";
import ReactDOM from "react-dom/client";
import Overlay from "./components/Overlay";
import { AppProvider, ThemeProvider } from "./contexts";
import "./global.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import AppRoutes from "./routes";
import { voiceRecorderController } from "@/lib/voice/VoiceRecorderController";

const currentWindow = getCurrentWindow();
const windowLabel = currentWindow.label;

// Cleanup voice resources when app closes
const cleanupVoiceResources = () => {
  console.log("[Voice Cleanup] Disposing voice recorder on app close");
  try {
    voiceRecorderController.dispose();
  } catch (error) {
    console.error("[Voice Cleanup] Error during voice cleanup:", error);
  }
};

// Register cleanup handlers
window.addEventListener("beforeunload", cleanupVoiceResources);
window.addEventListener("unload", cleanupVoiceResources);

// Tauri-specific cleanup on window close
if (window.__TAURI__) {
  currentWindow.onCloseRequested(() => {
    cleanupVoiceResources();
  });
}

// Render different components based on window label
if (windowLabel.startsWith("capture-overlay-")) {
  const monitorIndex = parseInt(windowLabel.split("-")[2], 10) || 0;
  // Render overlay without providers
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Overlay monitorIndex={monitorIndex} />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ThemeProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
