import { Navigate, useParams } from "react-router-dom";
import { TOGGLE_SETTINGS_SECTIONS } from "./toggle-settings.constants";
import { TOGGLE_SETTINGS_CONTENT } from "./toggle-settings.registry";
import { ToggleSettingsShell } from "./ToggleSettingsShell";

const ToggleSettingsSection = () => {
  const { section } = useParams<{ section: string }>();
  const sectionDefinition = TOGGLE_SETTINGS_SECTIONS.find((item) => item.id === section);

  if (!sectionDefinition) return <Navigate replace to="/toggle/settings" />;

  const SectionContent = TOGGLE_SETTINGS_CONTENT[sectionDefinition.id];

  return <ToggleSettingsShell backTo="/toggle/settings" description={sectionDefinition.description} title={sectionDefinition.title}>
    <SectionContent />
  </ToggleSettingsShell>;
};

export default ToggleSettingsSection;
