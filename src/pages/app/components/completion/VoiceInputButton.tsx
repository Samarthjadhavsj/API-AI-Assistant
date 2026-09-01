import { UseCompletionReturn } from "@/types";
import { Files } from "./Files";
import { Input } from "./Input";
import { Screenshot } from "./Screenshot";

/** Simplified composer without voice recording */
export const VoiceComposer = ({
  isHidden,
  ...completion
}: UseCompletionReturn & { isHidden: boolean }) => {
  return (
    <>
      <Input {...completion} isHidden={isHidden} />
      <Screenshot {...completion} />
      <Files {...completion} />
    </>
  );
};