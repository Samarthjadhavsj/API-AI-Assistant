import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { App } from "@/pages";
import ToggleSettings from "@/pages/app/ToggleSettings";
import ToggleSettingsLayout from "@/pages/app/ToggleSettingsLayout";
import ToggleSettingsSection from "@/pages/app/ToggleSettingsSection";
import MessageHistoryConversation from "@/pages/app/components/message-history/MessageHistoryConversation";

// Wrapper components to apply data-view attribute
const ToggleView = () => (
  <div data-view="toggle" className="w-screen h-screen">
    <App />
  </div>
);

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ToggleView />} />
        <Route path="/toggle/settings" element={<ToggleSettingsLayout />}>
          <Route index element={<ToggleSettings />} />
          <Route path=":section" element={<ToggleSettingsSection />} />
          <Route
            path="history/:conversationId"
            element={<MessageHistoryConversation />}
          />
        </Route>
      </Routes>
    </Router>
  );
}
