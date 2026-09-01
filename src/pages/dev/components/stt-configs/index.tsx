import { UseSettingsReturn } from "@/types";
import { UniversalSttForm } from "./UniversalSttForm";

export const STTProviders = (settings: UseSettingsReturn) => {
  return (
    <div id="stt-providers">
      <UniversalSttForm {...settings} />
    </div>
  );
};
