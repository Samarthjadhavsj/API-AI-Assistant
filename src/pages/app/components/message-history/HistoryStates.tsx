import { History, Loader2 } from "lucide-react";

export const HistoryLoading = ({ label = "Loading conversations…" }: { label?: string }) => (
  <div
    className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
    role="status"
  >
    <Loader2 className="size-4 animate-spin" />
    {label}
  </div>
);

export const HistoryEmpty = ({
  title = "No conversations yet",
  description = "Start chatting to create your first conversation.",
}: {
  title?: string;
  description?: string;
}) => (
  <div className="py-16 text-center">
    <History className="mx-auto mb-3 size-8 text-muted-foreground/40" />
    <p className="text-sm font-medium">{title}</p>
    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
  </div>
);
