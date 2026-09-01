import { useCompletion } from "@/hooks";
import { VoiceComposer } from "./VoiceInputButton";

export const Completion = ({
  isHidden,
}: {
  isHidden: boolean;
}) => {
  const completion = useCompletion();

  return <VoiceComposer {...completion} isHidden={isHidden} />;
};
