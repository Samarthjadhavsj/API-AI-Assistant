import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components";

interface DeleteConfirmationDialogProps {
  deleteConfirm?: string | null;
  /** Overrides `deleteConfirm` for dialogs not tied to a single id (e.g. Delete All). */
  open?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** External busy state (e.g. the owning hook is already deleting). */
  isLoading?: boolean;
  cancelDelete: () => void;
  confirmDelete: () => void | Promise<void>;
}

export const DeleteConfirmationDialog = ({
  deleteConfirm,
  open,
  title = "Delete Conversation",
  description = "Are you sure you want to delete this conversation? This action cannot be undone.",
  confirmLabel = "Delete",
  isLoading = false,
  cancelDelete,
  confirmDelete,
}: DeleteConfirmationDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  // A ref, not state, so a double click in the same tick is still ignored
  const isDeletingRef = useRef(false);

  if (!(open ?? Boolean(deleteConfirm))) return null;

  const isBusy = isDeleting || isLoading;

  const handleConfirm = async () => {
    if (isDeletingRef.current || isLoading) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      await confirmDelete();
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-background border rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancelDelete} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isBusy}
          >
            {isBusy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
