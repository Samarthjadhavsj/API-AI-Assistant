import { useId, type ElementType, type ReactNode } from "react";
import { AudioLinesIcon, CheckCircle2Icon, SparklesIcon, TrashIcon } from "lucide-react";
import { Button, Label } from "@/components";
import { ApiKeyInput } from "@/components/ui/api-key-input";
import { cn } from "@/lib/utils";
import {
  GEMINI_RESPONSE_MODELS,
  GEMINI_VOICE_MODELS,
} from "@/config/gemini-models.constants";
import type { ProviderVariables } from "@/lib/provider-settings";
import { GeminiModelSelect } from "./GeminiModelSelect";

/** A settings card: icon, title with a small badge, description, and a status/action. */
export const SettingsSection = ({
  icon: Icon,
  title,
  badge,
  description,
  action,
  variant = "builtin",
  children,
}: {
  icon: ElementType;
  title: string;
  badge?: string;
  description: string;
  action?: ReactNode;
  /** Built-in integrations are highlighted; manual ones are quieter. */
  variant?: "builtin" | "manual";
  children: ReactNode;
}) => {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border p-4",
        variant === "builtin" ? "border-primary/25" : "border-dashed border-border/70"
      )}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            variant === "builtin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id={headingId} className="text-sm font-semibold">
              {title}
            </h2>
            {badge && (
              <span className="rounded-full border border-border/70 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
};

/** "In use" when this provider answers questions; otherwise a button to use it. */
export const ProviderStatus = ({
  name,
  isActive,
  onActivate,
  disabled = false,
  disabledReason,
}: {
  name: string;
  isActive: boolean;
  onActivate?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) =>
  isActive ? (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
      aria-label={`${name} is in use`}
    >
      <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
      In use
    </span>
  ) : onActivate ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2.5 text-xs"
      onClick={onActivate}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
    >
      Use {name}
    </Button>
  ) : null;

export const ApiKeyField = ({
  label,
  value,
  onChange,
  placeholder = "Paste your API key",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium" htmlFor={id}>
        {label}
      </Label>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <ApiKeyInput
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            aria-describedby={`${id}-hint`}
            className="h-11 border-1 border-input/50 transition-colors focus:border-primary/50"
          />
        </div>
        {value.trim() && (
          <Button
            type="button"
            onClick={() => onChange("")}
            size="icon"
            variant="destructive"
            className="h-11 w-11 shrink-0"
            title="Remove API key"
            aria-label={`Remove ${label}`}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
        Stored locally on this device and never shared.
      </p>
    </div>
  );
};

/**
 * Section 1 of AI Providers: the built-in Gemini integration. Edits Gemini's
 * own saved settings, whether or not Gemini is the provider in use.
 */
export const GeminiResponseSettings = ({
  variables,
  onChange,
  isActive,
  onActivate,
}: {
  variables: ProviderVariables;
  onChange: (variables: ProviderVariables) => void;
  isActive: boolean;
  onActivate?: () => void;
}) => {
  const update = (key: "api_key" | "model", value: string) =>
    onChange({ ...variables, [key]: value });
  const missing = [
    !variables.api_key?.trim() && "an API key",
    !variables.model?.trim() && "a model",
  ].filter(Boolean);

  return (
    <SettingsSection
      icon={SparklesIcon}
      title="Gemini"
      badge="Built-in"
      description="Google Gemini, built in. Pick a model by its daily request limit."
      action={
        <ProviderStatus
          name="Gemini"
          isActive={isActive}
          onActivate={onActivate}
          disabled={missing.length > 0}
          disabledReason={`Add ${missing.join(" and ")} first`}
        />
      }
    >
      <ApiKeyField
        label="Gemini API key"
        value={variables.api_key ?? ""}
        onChange={(value) => update("api_key", value)}
        placeholder="Paste your Gemini API key"
      />
      <GeminiModelSelect
        label="Model"
        orderNote="Most requests per day first"
        models={GEMINI_RESPONSE_MODELS}
        value={variables.model}
        onChange={(model) => update("model", model)}
        customPlaceholder="e.g. gemini-3.5-flash-lite"
      />
      {missing.length > 0 && (
        <p className="text-[11px] text-muted-foreground" role="status">
          {isActive
            ? `Gemini is in use but can't answer yet. Add ${missing.join(" and ")}.`
            : `Add ${missing.join(" and ")} to use Gemini.`}
        </p>
      )}
    </SettingsSection>
  );
};

/**
 * Section 1 of Voice Transcription: the built-in Gemini Voice. Edits Gemini
 * Voice's own saved settings, whether or not it's the voice provider in use.
 */
export const GeminiVoiceSettings = ({
  variables,
  onChange,
  isActive,
  onActivate,
}: {
  variables: ProviderVariables;
  onChange: (variables: ProviderVariables) => void;
  isActive: boolean;
  onActivate?: () => void;
}) => {
  const update = (key: "api_key" | "model", value: string) =>
    onChange({ ...variables, [key]: value });
  const hasKey = !!variables.api_key?.trim();

  return (
    <SettingsSection
      icon={AudioLinesIcon}
      title="Gemini Voice"
      badge="Built-in"
      description="Turns your speech into text with a Gemini Live model."
      action={
        <ProviderStatus
          name="Gemini Voice"
          isActive={isActive}
          onActivate={onActivate}
          disabled={!hasKey}
          disabledReason="Add an API key first"
        />
      }
    >
      <ApiKeyField
        label="Gemini API key"
        value={variables.api_key ?? ""}
        onChange={(value) => update("api_key", value)}
        placeholder="Paste your Gemini API key"
      />
      <GeminiModelSelect
        label="Voice model"
        orderNote="All unlimited per day · most tokens per minute first"
        models={GEMINI_VOICE_MODELS}
        value={variables.model}
        onChange={(model) => update("model", model)}
        customPlaceholder="e.g. gemini-3.5-transcribe-live"
      />
    </SettingsSection>
  );
};
