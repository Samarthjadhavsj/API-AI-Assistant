import { useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button, ScrollArea } from "@/components";
import {
  PaperclipIcon,
  XIcon,
  PlusIcon,
  TrashIcon,
  FileTextIcon,
  AlertCircleIcon,
  Loader2,
} from "lucide-react";
import { UseCompletionReturn } from "@/types";
import { MAX_FILES } from "@/config";
import { ATTACHMENT_ACCEPT, formatBytes, isImageAttachment } from "@/lib/attachments";

export const Files = ({
  attachedFiles,
  handleFileSelect,
  removeFile,
  onRemoveAllFiles,
  isLoading,
  isFilesPopoverOpen,
  setIsFilesPopoverOpen,
  attachmentNotices = [],
  dismissAttachmentNotices,
  isReadingAttachments = false,
}: UseCompletionReturn) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddMoreClick = () => {
    fileInputRef.current?.click();
  };

  const canAddMore = attachedFiles.length < MAX_FILES;
  const hasNotices = attachmentNotices.length > 0;

  return (
    <div className="relative mt-1 shrink-0">
      <Popover
        open={isFilesPopoverOpen}
        onOpenChange={(open) => {
          setIsFilesPopoverOpen(open);
          // Notices explain the last pick; they're done once the panel closes.
          if (!open) dismissAttachmentNotices?.();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            size="icon"
            onClick={() => {
              if (attachedFiles.length === 0 && !hasNotices) {
                // If no files, directly open file picker
                fileInputRef.current?.click();
              } else {
                // If files exist, show popover
                setIsFilesPopoverOpen(true);
              }
            }}
            disabled={isLoading}
            className="size-8 cursor-pointer"
            title="Attach files"
            aria-busy={isReadingAttachments}
            data-tauri-drag-region={false}
          >
            {isReadingAttachments ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PaperclipIcon className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>

        {/* File count badge */}
        {attachedFiles.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary-foreground text-primary rounded-full h-5 w-5 flex border border-primary items-center justify-center text-xs font-medium">
            {attachedFiles.length}
          </div>
        )}

        {(attachedFiles.length > 0 || hasNotices) && (
          <PopoverContent
            align="end"
            side="bottom"
            className="w-screen p-0 border shadow-lg overflow-hidden"
            sideOffset={8}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <h3 className="font-semibold text-sm select-none">
                Attachments ({attachedFiles.length}/{MAX_FILES})
              </h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsFilesPopoverOpen(false);
                  dismissAttachmentNotices?.();
                }}
                className="cursor-pointer"
                title="Close"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="p-4 h-[calc(100vh-11rem)]">
              {hasNotices && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
                >
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <AlertCircleIcon className="h-4 w-4 shrink-0" />
                    Some files weren't attached
                  </div>
                  <ul className="space-y-1 pl-6 list-disc break-words">
                    {attachmentNotices.map((notice, index) => (
                      <li key={index}>{notice}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grid layout based on number of files */}
              <div
                className={`gap-3 ${
                  attachedFiles.length <= 2
                    ? "flex flex-col"
                    : "grid grid-cols-2"
                }`}
              >
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="relative group border rounded-lg overflow-hidden bg-muted/20"
                  >
                    {isImageAttachment(file) ? (
                      <img
                        src={`data:${file.type};base64,${file.base64}`}
                        alt={file.name}
                        className={`w-full object-cover h-full`}
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center text-muted-foreground">
                        <FileTextIcon className="h-10 w-10" />
                      </div>
                    )}

                    {/* File info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                      <div className="truncate font-medium" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-gray-300">{formatBytes(file.size)}</div>
                    </div>

                    {/* Remove button */}
                    <Button
                      size="icon"
                      variant="default"
                      className="absolute top-2 right-2 h-6 w-6 cursor-pointer"
                      onClick={() => removeFile(file.id)}
                      title="Remove attachment"
                      aria-label={`Remove ${file.name}`}
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Sticky footer with Add More button */}
            <div className="sticky bottom-0 border-t bg-background p-3 flex flex-row gap-2">
              <Button
                onClick={handleAddMoreClick}
                disabled={!canAddMore || isLoading}
                className="w-2/4"
                variant="outline"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add More Files {!canAddMore && `(${MAX_FILES} max)`}
              </Button>
              <Button
                className="w-2/4"
                variant="destructive"
                onClick={onRemoveAllFiles}
                disabled={attachedFiles.length === 0}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Remove All Files
              </Button>
            </div>
          </PopoverContent>
        )}
      </Popover>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        onChange={handleFileSelect}
        className="hidden"
        data-testid="attachment-input"
      />
    </div>
  );
};
