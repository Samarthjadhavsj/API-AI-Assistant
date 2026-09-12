import { useCompletion } from "@/hooks";
import { VoiceComposer } from "./VoiceInputButton";
export { VoiceInputBar } from "./VoiceInputBar";

export const Completion = ({
  isHidden,
  onVoiceStateChange,
}: {
  isHidden: boolean;
  onVoiceStateChange?: (state: string) => void;
}) => {
  const completion = useCompletion();

  return <VoiceComposer {...completion} isHidden={isHidden} onVoiceStateChange={onVoiceStateChange} />;
};
