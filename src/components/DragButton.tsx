import { GripVerticalIcon } from "lucide-react";
import { Button } from "@/components";

export const DragButton = () => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`-ml-[2px] h-8 w-fit`}
      data-tauri-drag-region
    >
      <GripVerticalIcon className="h-4 w-4" />
    </Button>
  );
};
