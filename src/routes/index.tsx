import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  Dashboard,
  App,
  SystemPrompts,
  ViewChat,
  Settings,
  DevSpace,
  Shortcuts,
  Screenshot,
  Chats,
  Responses,
} from "@/pages";
import { DashboardLayout } from "@/layouts";
import ToggleSettings from "@/pages/app/ToggleSettings";
import ToggleSettingsLayout from "@/pages/app/ToggleSettingsLayout";
import ToggleSettingsSection from "@/pages/app/ToggleSettingsSection";

// Wrapper components to apply data-view attribute
const ToggleView = () => (
  <div data-view="toggle" className="w-screen h-screen">
    <App />
  </div>
);

const DashboardView = () => (
  <div data-view="dashboard" className="w-screen h-screen">
    <DashboardLayout />
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
        </Route>
        <Route element={<DashboardView />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/system-prompts" element={<SystemPrompts />} />
          <Route path="/chats/view/:conversationId" element={<ViewChat />} />
          <Route path="/shortcuts" element={<Shortcuts />} />
          <Route path="/screenshot" element={<Screenshot />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/responses" element={<Responses />} />
          <Route path="/dev-space" element={<DevSpace />} />
        </Route>
      </Routes>
    </Router>
  );
}
