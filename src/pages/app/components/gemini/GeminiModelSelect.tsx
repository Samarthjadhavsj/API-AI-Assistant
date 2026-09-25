import { useEffect, useId, useRef, useState } from "react";
import { PencilLineIcon } from "lucide-react";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components";
import { cn } from "@/lib/utils";
import {
  findGeminiModel,
  formatGeminiQuota,
  type GeminiModelOption,
} from "@/config/gemini-models.constants";

export const CUSTOM_MODEL_VALUE = "__custom_model__";

// One compact line per option (name left, quota right) so the whole list fits
// in the 600×560 settings window without scrolling. The item's text wrapper
// is stretched so the quota column lines up.
const OPTION_CLASS = "h-7 py-0.5 [&>span:last-child]:w-full [&>span:last-child]:min-w-0";
const QUOTA_CLASS = "ml-auto shrink-0 pl-3 text-right text-[11px] tabular-nums text-muted-foreground";

interface GeminiModelSelectProps {
  /** Visible label, e.g. "Model" or "Voice model". */
  label: string;
  /** Explains the list order, shown above the options. */
  orderNote: string;
  models: readonly GeminiModelOption[];
  /** The saved model ID. */
  value: string | undefined;
  /** Saves a model ID (always non-empty and trimmed). */
  onChange: (modelId: string) => void;
  customPlaceholder: string;
}

/**
 * Gemini model picker: listed models in quota order with their limits, then
 * "Custom model", which reveals a model-ID field. A saved ID that isn't listed
 * is shown as a custom model, so existing settings keep working.
 */
export const GeminiModelSelect = ({
  label,
  orderNote,
  models,
  value,
  onChange,
  customPlaceholder,
}: GeminiModelSelectProps) => {
  const id = useId();
  const savedModel = value?.trim() ?? "";
  const listed = findGeminiModel(models, savedModel);
  const savedIsCustom = !listed && savedModel !== "";

  const [customMode, setCustomMode] = useState(savedIsCustom);
  const [draft, setDraft] = useState(savedIsCustom ? savedModel : "");
  // An empty custom ID is only flagged once the user tries to leave it empty.
  const [touched, setTouched] = useState(false);
  // The last custom ID, so switching away and back restores it.
  const lastCustomRef = useRef(savedIsCustom ? savedModel : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const focusCustomInput = useRef(false);
  // The last ID this field saved: typing "gemini-2.5-flash-lite" passes
  // through the listed "gemini-2.5-flash", which mustn't switch modes mid-word.
  const lastSavedRef = useRef<string | null>(null);

  // Follow the saved value when it changes elsewhere (another window, reload).
  useEffect(() => {
    if (savedModel === lastSavedRef.current) return;
    lastSavedRef.current = null;
    if (listed) {
      setCustomMode(false);
    } else if (savedModel) {
      setCustomMode(true);
      setDraft(savedModel);
      lastCustomRef.current = savedModel;
    }
  }, [savedModel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Choosing "Custom model" moves focus to the ID field instead of back to
  // the dropdown, so it can be typed into straight away.
  const handleCloseAutoFocus = (event: Event) => {
    if (!focusCustomInput.current) return;
    focusCustomInput.current = false;
    event.preventDefault();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const selectValue = customMode ? CUSTOM_MODEL_VALUE : listed?.id ?? "";

  const handleSelect = (next: string) => {
    if (next === CUSTOM_MODEL_VALUE) {
      const restored = lastCustomRef.current;
      setDraft(restored);
      setTouched(false);
      setCustomMode(true);
      focusCustomInput.current = true;
      if (restored) {
        lastSavedRef.current = restored;
        onChange(restored);
      }
      return;
    }
    setCustomMode(false);
    lastSavedRef.current = next;
    onChange(next);
  };

  const handleDraftChange = (next: string) => {
    setDraft(next);
    const trimmed = next.trim();
    if (trimmed) {
      lastCustomRef.current = trimmed;
      lastSavedRef.current = trimmed;
      onChange(trimmed);
    } else if (draft.trim()) {
      // Cleared an ID that was there: that's an attempt to save it empty.
      setTouched(true);
    }
  };

  const markTouchedIfEmpty = () => {
    if (!draft.trim()) setTouched(true);
  };

  const triggerId = `${id}-model`;
  const idHintId = `${id}-model-id`;
  const customId = `${id}-custom`;
  const customHintId = `${id}-custom-hint`;
  const draftEmpty = customMode && !draft.trim();
  const showError = draftEmpty && touched;
  const stillInUse = draftEmpty && savedModel ? listed?.name ?? savedModel : null;

  const customHint = draftEmpty
    ? showError
      ? stillInUse
        ? `Enter a model ID to use a custom model. ${stillInUse} is still in use.`
        : "Enter a model ID to use a custom model."
      : stillInUse
        ? `Enter a model ID. ${stillInUse} stays in use until you do.`
        : "Enter a model ID to use."
    : "Used exactly as entered.";

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium" htmlFor={triggerId}>
        {label}
      </Label>
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger
          id={triggerId}
          aria-describedby={listed && !customMode ? idHintId : undefined}
          // Radix's SelectValue ignores className: stretch it from the trigger so
          // the quota sits at the right, like in the list.
          className="h-11 w-full border-1 border-input/50 shadow-none transition-colors focus:border-primary/50 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1"
        >
          <SelectValue placeholder="Choose a model">
            {customMode ? (
              <span className="flex min-w-0 items-center gap-2">
                <PencilLineIcon className="size-3.5" />
                <span className="truncate">Custom model</span>
              </span>
            ) : listed ? (
              <span className="flex w-full min-w-0 items-center gap-2">
                <span className="truncate">{listed.name}</span>
                <span className={QUOTA_CLASS}>{formatGeminiQuota(listed.quota)}</span>
              </span>
            ) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={handleCloseAutoFocus}>
          <SelectGroup>
            <SelectLabel className="py-0.5 text-[11px]">{orderNote}</SelectLabel>
            {models.map((model) => (
              <SelectItem
                key={model.id}
                value={model.id}
                textValue={model.name}
                className={OPTION_CLASS}
              >
                <span className="flex w-full min-w-0 items-center">
                  <span className="truncate font-medium">{model.name}</span>
                  <span className={QUOTA_CLASS} data-quota>
                    {formatGeminiQuota(model.quota)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={CUSTOM_MODEL_VALUE} textValue="Custom model" className={OPTION_CLASS}>
            <span className="flex w-full min-w-0 items-center gap-2">
              <PencilLineIcon className="size-3.5" />
              <span className="truncate font-medium">Custom model</span>
              <span className={QUOTA_CLASS}>Any model ID</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {listed && !customMode && (
        <p id={idHintId} className="text-[11px] text-muted-foreground">
          Model ID: <span className="font-mono">{listed.id}</span>
        </p>
      )}

      {customMode && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium" htmlFor={customId}>
            Custom model ID
          </Label>
          <Input
            ref={inputRef}
            id={customId}
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            onBlur={markTouchedIfEmpty}
            onKeyDown={(event) => {
              if (event.key === "Enter") markTouchedIfEmpty();
            }}
            placeholder={customPlaceholder}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={showError || undefined}
            aria-describedby={customHintId}
            // The shared Input's dark-mode border hides its error border.
            className="h-10 font-mono text-xs dark:aria-invalid:border-destructive"
          />
          <p
            id={customHintId}
            className={cn("text-[11px]", showError ? "text-destructive" : "text-muted-foreground")}
          >
            {customHint}
          </p>
        </div>
      )}
    </div>
  );
};
